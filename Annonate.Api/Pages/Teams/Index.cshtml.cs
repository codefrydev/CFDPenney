using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Annonate.Api.Data;
using Annonate.Api.DTOs;
using Annonate.Api.Models;

namespace Annonate.Api.Pages.Teams;

[Authorize]
[IgnoreAntiforgeryToken]
public class IndexModel : PageModel
{
    private readonly ApplicationDbContext _context;

    public IndexModel(ApplicationDbContext context)
    {
        _context = context;
    }

    public IActionResult OnGet()
    {
        return NotFound();
    }

    private Guid GetUserId()
    {
        var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return userId;
        }
        return Guid.Parse("00000000-0000-0000-0000-000000000001");
    }

    public async Task<IActionResult> OnGetTeamsAsync()
    {
        var userId = GetUserId();

        var teams = await _context.Teams
            .Include(t => t.Members)
            .Include(t => t.Channels)
                .ThenInclude(c => c.Posts)
                    .ThenInclude(p => p.Replies)
            .Where(t => t.Members.Any(m => m.UserId == userId))
            .Select(t => new
            {
                id = t.Id,
                name = t.Name,
                icon = t.Icon,
                channels = t.Channels.Select(c => new
                {
                    id = c.Id,
                    name = c.Name,
                    posts = c.Posts.Select(p => new
                    {
                        id = p.Id,
                        user = p.UserId,
                        text = p.Text,
                        time = p.CreatedAt < DateTime.UtcNow.AddDays(-1) ? p.CreatedAt.ToString("ddd") : p.CreatedAt.ToString("hh:mm tt"),
                        replies = p.Replies.Select(r => new
                        {
                            user = r.UserId,
                            text = r.Text,
                            time = r.CreatedAt.ToString("hh:mm tt")
                        }).ToList()
                    }).ToList()
                }).ToList()
            })
            .ToListAsync();

        return new JsonResult(ApiResponse<List<object>>.SuccessResponse(teams.Cast<object>().ToList()));
    }

    public async Task<IActionResult> OnGetChannelPostsAsync([FromQuery] string teamId, [FromQuery] string channelId)
    {
        var userId = GetUserId();

        var isTeamMember = await _context.TeamMembers
            .AnyAsync(tm => tm.TeamId == teamId && tm.UserId == userId);

        if (!isTeamMember)
        {
            return new JsonResult(ApiResponse<List<object>>.ErrorResponse("Team not found or access denied"));
        }

        var channel = await _context.Channels
            .Include(c => c.Posts)
                .ThenInclude(p => p.Replies)
            .FirstOrDefaultAsync(c => c.Id == channelId && c.TeamId == teamId);

        if (channel == null)
        {
            return new JsonResult(ApiResponse<List<object>>.ErrorResponse("Channel not found"));
        }

        var posts = channel.Posts
            .OrderBy(p => p.CreatedAt)
            .Select(p => new
            {
                id = p.Id,
                user = p.UserId,
                text = p.Text,
                time = p.CreatedAt < DateTime.UtcNow.AddDays(-1)
                    ? p.CreatedAt.ToString("ddd")
                    : p.CreatedAt.ToString("hh:mm tt"),
                replies = p.Replies.Select(r => new
                {
                    user = r.UserId,
                    text = r.Text,
                    time = r.CreatedAt.ToString("hh:mm tt")
                }).ToList()
            })
            .ToList();

        return new JsonResult(ApiResponse<List<object>>.SuccessResponse(posts.Cast<object>().ToList()));
    }
}
