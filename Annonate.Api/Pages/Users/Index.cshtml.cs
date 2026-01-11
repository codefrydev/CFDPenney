using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Annonate.Api.Data;
using Annonate.Api.DTOs;
using Annonate.Api.Hubs;

namespace Annonate.Api.Pages.Users;

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

    public async Task<IActionResult> OnGetUsersAsync()
    {
        var onlineUserIds = ChatHub.GetOnlineUserIds();

        var users = await _context.Users
            .Select(u => new
            {
                id = u.Id,
                name = u.Name,
                email = u.Email,
                role = u.Role,
                status = onlineUserIds.Contains(u.Id) ? "available" : (u.Status ?? "offline"),
                avatar = u.Avatar,
                statusMessage = u.StatusMessage,
                lastSeen = u.LastSeen,
                isOnline = onlineUserIds.Contains(u.Id)
            })
            .ToListAsync();

        return new JsonResult(ApiResponse<List<object>>.SuccessResponse(users.Cast<object>().ToList()));
    }
}
