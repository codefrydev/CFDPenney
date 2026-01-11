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
public class SearchController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public SearchController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<object>>> Search([FromQuery] string query)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return Ok(ApiResponse<object>.SuccessResponse(new
            {
                messages = new List<object>(),
                chats = new List<object>(),
                users = new List<object>()
            }));
        }

        // TEMPORARY: Use default userId when auth is disabled
        var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier);
        var userId = userIdClaim != null ? Guid.Parse(userIdClaim.Value) : Guid.Parse("00000000-0000-0000-0000-000000000001");

        var searchTerm = query.Trim().ToLower();

        // Search Messages
        var messageResults = await _context.Messages
            .Include(m => m.Chat)
                .ThenInclude(c => c.Members)
                    .ThenInclude(cm => cm.User)
            .Include(m => m.Sender)
            .Where(m => m.Text.ToLower().Contains(searchTerm) &&
                       m.Chat.Members.Any(cm => cm.UserId == userId))
            .OrderByDescending(m => m.CreatedAt)
            .Take(10)
            .Select(m => new
            {
                type = "message",
                id = m.Id,
                text = m.Text,
                chatId = m.ChatId,
                chatName = m.Chat.IsGroup ? m.Chat.GroupName : 
                          m.Chat.Members.First(cm => cm.UserId != userId).User.Name,
                senderId = m.SenderId,
                senderName = m.Sender.Name,
                time = m.CreatedAt.ToString("hh:mm tt"),
                date = m.CreatedAt.ToString("MMM dd, yyyy")
            })
            .ToListAsync();

        // Search Chats
        var chatResults = await _context.Chats
            .Include(c => c.Members)
                .ThenInclude(m => m.User)
            .Where(c => c.Members.Any(cm => cm.UserId == userId) &&
                       (c.IsGroup && c.GroupName != null && c.GroupName.ToLower().Contains(searchTerm) ||
                        !c.IsGroup && c.Members.Any(cm => cm.UserId != userId && 
                            (cm.User.Name.ToLower().Contains(searchTerm) || 
                             cm.User.Email.ToLower().Contains(searchTerm)))))
            .OrderByDescending(c => c.UpdatedAt)
            .Take(10)
            .Select(c => new
            {
                type = "chat",
                id = c.Id,
                name = c.IsGroup ? c.GroupName : 
                       c.Members.First(cm => cm.UserId != userId).User.Name,
                isGroup = c.IsGroup,
                participants = c.Members
                    .Where(cm => cm.UserId != userId)
                    .Select(cm => new
                    {
                        id = cm.User.Id,
                        name = cm.User.Name,
                        email = cm.User.Email,
                        avatar = cm.User.Avatar
                    })
                    .ToList(),
                lastMessage = c.Messages.OrderByDescending(m => m.CreatedAt).FirstOrDefault() != null ?
                    c.Messages.OrderByDescending(m => m.CreatedAt).First().Text : "",
                timestamp = c.Messages.OrderByDescending(m => m.CreatedAt).FirstOrDefault() != null ?
                    c.Messages.OrderByDescending(m => m.CreatedAt).First().CreatedAt.ToString("hh:mm tt") : ""
            })
            .ToListAsync();

        // Search Users
        var userResults = await _context.Users
            .Where(u => u.Id != userId &&
                       (u.Name.ToLower().Contains(searchTerm) || 
                        u.Email.ToLower().Contains(searchTerm)))
            .OrderBy(u => u.Name)
            .Take(10)
            .Select(u => new
            {
                type = "user",
                id = u.Id,
                name = u.Name,
                email = u.Email,
                avatar = u.Avatar,
                status = u.Status,
                statusMessage = u.StatusMessage
            })
            .ToListAsync();

        var results = new
        {
            messages = messageResults.Cast<object>().ToList(),
            chats = chatResults.Cast<object>().ToList(),
            users = userResults.Cast<object>().ToList()
        };

        return Ok(ApiResponse<object>.SuccessResponse(results));
    }
}
