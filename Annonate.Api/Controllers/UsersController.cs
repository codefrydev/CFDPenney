using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Annonate.Api.Data;
using Annonate.Api.DTOs;
using Annonate.Api.Hubs;

namespace Annonate.Api.Controllers;

// [Authorize] - TEMPORARILY DISABLED
[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public UsersController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<object>>>> GetUsers()
    {
        // Get online user IDs from ChatHub
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

        return Ok(ApiResponse<List<object>>.SuccessResponse(users.Cast<object>().ToList()));
    }
}
