using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Annonate.Api.Data;
using Annonate.Api.DTOs;
using Annonate.Api.Models;

namespace Annonate.Api.Controllers;

// [Authorize] - TEMPORARILY DISABLED
[ApiController]
[Route("api/[controller]")]
public class MessagesController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public MessagesController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("{chatId}")]
    public async Task<ActionResult<ApiResponse<List<object>>>> GetMessages(Guid chatId)
    {
        // TEMPORARY: Use default userId when auth is disabled
        var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier);
        var userId = userIdClaim != null ? Guid.Parse(userIdClaim.Value) : Guid.Parse("00000000-0000-0000-0000-000000000001");

        var messages = await _context.Messages
            .Where(m => m.ChatId == chatId)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new
            {
                id = m.Id,
                senderId = m.SenderId,
                text = m.Text,
                time = m.CreatedAt.ToString("hh:mm tt"),
                type = m.Type,
                chatId = m.ChatId
            })
            .ToListAsync();

        // Mark messages as read
        var chatMember = await _context.ChatMembers
            .FirstOrDefaultAsync(cm => cm.ChatId == chatId && cm.UserId == userId);
        if (chatMember != null)
        {
            chatMember.UnreadCount = 0;
            chatMember.LastReadAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        return Ok(ApiResponse<List<object>>.SuccessResponse(messages.Cast<object>().ToList()));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<object>>> SendMessage([FromBody] SendMessageRequest request)
    {
        // TEMPORARY: Use default userId when auth is disabled
        var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier);
        var userId = userIdClaim != null ? Guid.Parse(userIdClaim.Value) : Guid.Parse("00000000-0000-0000-0000-000000000001");

        var message = new Message
        {
            ChatId = request.ChatId,
            SenderId = userId,
            Text = request.Text,
            Type = "text",
            CreatedAt = DateTime.UtcNow
        };

        _context.Messages.Add(message);

        // Update unread counts for other chat members
        var chatMembers = await _context.ChatMembers
            .Where(cm => cm.ChatId == request.ChatId && cm.UserId != userId)
            .ToListAsync();
        foreach (var member in chatMembers)
        {
            member.UnreadCount++;
        }

        await _context.SaveChangesAsync();

        var response = new
        {
            id = message.Id,
            chatId = message.ChatId,
            senderId = message.SenderId,
            text = message.Text,
            time = message.CreatedAt.ToString("hh:mm tt"),
            type = message.Type
        };

        return Ok(ApiResponse<object>.SuccessResponse(response));
    }
}

public class SendMessageRequest
{
    public Guid ChatId { get; set; }
    public string Text { get; set; } = string.Empty;
}
