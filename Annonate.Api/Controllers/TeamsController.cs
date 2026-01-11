using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Annonate.Api.Data;
using Annonate.Api.DTOs;

namespace Annonate.Api.Controllers;

// [Authorize] - TEMPORARILY DISABLED
[ApiController]
[Route("api/[controller]")]
public class TeamsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public TeamsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<object>>>> GetTeams()
    {
        // TEMPORARY: Use default userId when auth is disabled
        var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier);
        var userId = userIdClaim != null ? Guid.Parse(userIdClaim.Value) : Guid.Parse("00000000-0000-0000-0000-000000000001");

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

        return Ok(ApiResponse<List<object>>.SuccessResponse(teams.Cast<object>().ToList()));
    }

    [HttpGet("{teamId}/channels/{channelId}/posts")]
    public async Task<ActionResult<ApiResponse<List<object>>>> GetChannelPosts(string teamId, string channelId)
    {
        // TEMPORARY: Use default userId when auth is disabled
        var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier);
        var userId = userIdClaim != null ? Guid.Parse(userIdClaim.Value) : Guid.Parse("00000000-0000-0000-0000-000000000001");

        // Verify user is a member of the team
        var isTeamMember = await _context.TeamMembers
            .AnyAsync(tm => tm.TeamId == teamId && tm.UserId == userId);

        if (!isTeamMember)
        {
            return NotFound(ApiResponse<List<object>>.ErrorResponse("Team not found or access denied"));
        }

        // Verify channel exists and belongs to the team
        var channel = await _context.Channels
            .Include(c => c.Posts)
                .ThenInclude(p => p.Replies)
            .FirstOrDefaultAsync(c => c.Id == channelId && c.TeamId == teamId);

        if (channel == null)
        {
            return NotFound(ApiResponse<List<object>>.ErrorResponse("Channel not found"));
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

        return Ok(ApiResponse<List<object>>.SuccessResponse(posts.Cast<object>().ToList()));
    }
}
