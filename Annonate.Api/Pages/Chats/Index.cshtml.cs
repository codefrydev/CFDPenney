using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Security.Claims;
using Annonate.Api.Data;
using Annonate.Api.DTOs;
using Annonate.Api.Hubs;
using Annonate.Api.Models;

namespace Annonate.Api.Pages.Chats;

[Authorize]
[IgnoreAntiforgeryToken]
public class IndexModel : PageModel
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<IndexModel> _logger;

    public IndexModel(ApplicationDbContext context, ILogger<IndexModel> logger)
    {
        _context = context;
        _logger = logger;
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

    public async Task<IActionResult> OnGetChatsAsync()
    {
        var userId = GetUserId();

        var chats = await _context.Chats
            .Include(c => c.Members)
                .ThenInclude(m => m.User)
            .Include(c => c.Messages.OrderByDescending(m => m.CreatedAt).Take(1))
            .Where(c => c.Members.Any(m => m.UserId == userId))
            .ToListAsync();

        var chatResults = chats.Select(c =>
        {
            var otherMember = c.Members.FirstOrDefault(m => m.UserId != userId);
            var currentMember = c.Members.FirstOrDefault(m => m.UserId == userId);
            var lastMessage = c.Messages.FirstOrDefault();

            return new
            {
                id = c.Id,
                userId = otherMember?.UserId ?? Guid.Empty,
                lastMessage = lastMessage?.Text ?? "",
                timestamp = lastMessage != null ? lastMessage.CreatedAt.ToString("hh:mm tt") : "",
                unread = currentMember?.UnreadCount ?? 0,
                isGroup = c.IsGroup
            };
        }).ToList();

        return new JsonResult(ApiResponse<List<object>>.SuccessResponse(chatResults.Cast<object>().ToList()));
    }

    public async Task<IActionResult> OnGetMessagesAsync([FromQuery] Guid chatId, [FromQuery] int limit = 20)
    {
        var userId = GetUserId();

        // Verify user is a member of this chat
        var isMember = await _context.ChatMembers
            .AnyAsync(cm => cm.ChatId == chatId && cm.UserId == userId);

        if (!isMember)
        {
            return new JsonResult(ApiResponse<List<object>>.ErrorResponse("You are not a member of this chat"));
        }

        // Get last N messages ordered by creation date (newest first, then reverse for display)
        var messages = await _context.Messages
            .Where(m => m.ChatId == chatId)
            .OrderByDescending(m => m.CreatedAt)
            .Take(limit)
            .OrderBy(m => m.CreatedAt) // Reverse order for display (oldest first)
            .Select(m => new
            {
                id = m.Id,
                senderId = m.SenderId == userId ? "me" : m.SenderId.ToString(),
                text = m.Text,
                time = m.CreatedAt.ToString("hh:mm tt"),
                type = m.Type
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

        return new JsonResult(ApiResponse<List<object>>.SuccessResponse(messages.Cast<object>().ToList()));
    }

    public async Task<IActionResult> OnPostCreateChatAsync([FromBody] CreateChatRequest request)
    {
        try
        {
            if (request == null || request.UserId == Guid.Empty)
            {
                return new JsonResult(ApiResponse<object>.ErrorResponse("UserId is required"));
            }

            var userId = GetUserId();

            if (userId == request.UserId)
            {
                return new JsonResult(ApiResponse<object>.ErrorResponse("Cannot create a chat with yourself"));
            }

            // Check if chat already exists
            var existingChat = await _context.Chats
                .Include(c => c.Members)
                .Where(c => !c.IsGroup &&
                           c.Members.Any(m => m.UserId == userId) &&
                           c.Members.Any(m => m.UserId == request.UserId))
                .FirstOrDefaultAsync();

            if (existingChat != null)
            {
                var otherMember = existingChat.Members.FirstOrDefault(m => m.UserId == userId);
                var currentMember = existingChat.Members.FirstOrDefault(m => m.UserId == userId);

                var chat = new
                {
                    id = existingChat.Id,
                    userId = otherMember?.UserId ?? Guid.Empty,
                    lastMessage = "",
                    timestamp = "",
                    unread = currentMember?.UnreadCount ?? 0,
                    isGroup = existingChat.IsGroup,
                    messages = new List<object>()
                };

                return new JsonResult(ApiResponse<object>.SuccessResponse(chat));
            }

            // Create new chat
            var newChat = new Models.Chat
            {
                IsGroup = false,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Chats.Add(newChat);
            await _context.SaveChangesAsync();

            _context.ChatMembers.Add(new Models.ChatMember
            {
                ChatId = newChat.Id,
                UserId = userId,
                UnreadCount = 0
            });

            _context.ChatMembers.Add(new Models.ChatMember
            {
                ChatId = newChat.Id,
                UserId = request.UserId,
                UnreadCount = 0
            });

            await _context.SaveChangesAsync();

            var createdChatMembers = await _context.ChatMembers
                .Include(m => m.User)
                .Where(m => m.ChatId == newChat.Id)
                .ToListAsync();

            var otherMemberCreated = createdChatMembers.FirstOrDefault(m => m.UserId != userId);
            var currentMemberCreated = createdChatMembers.FirstOrDefault(m => m.UserId == userId);

            var createdChat = new
            {
                id = newChat.Id,
                userId = otherMemberCreated?.UserId ?? Guid.Empty,
                lastMessage = "",
                timestamp = "",
                unread = 0,
                isGroup = newChat.IsGroup,
                messages = new List<object>()
            };

            return new JsonResult(ApiResponse<object>.SuccessResponse(createdChat));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating chat");
            return new JsonResult(ApiResponse<object>.ErrorResponse("An error occurred while creating the chat"));
        }
    }

    public async Task<IActionResult> OnPostSendMessageAsync([FromBody] SendMessageRequest request)
    {
        var userId = GetUserId();

        var message = new Models.Message
        {
            ChatId = request.ChatId,
            SenderId = userId,
            Text = request.Text,
            Type = "text",
            CreatedAt = DateTime.UtcNow
        };

        _context.Messages.Add(message);

        // Update unread counts
        var chatMembers = await _context.ChatMembers
            .Where(cm => cm.ChatId == request.ChatId && cm.UserId != userId)
            .ToListAsync();
        foreach (var member in chatMembers)
        {
            member.UnreadCount++;
        }

        await _context.SaveChangesAsync();

        // Broadcast message via SignalR
        var hubContext = HttpContext.RequestServices.GetRequiredService<IHubContext<ChatHub>>();
        var signalRMessage = new
        {
            id = message.Id,
            chatId = message.ChatId,
            senderId = userId.ToString(), // Use actual userId for SignalR, frontend will convert "me" when rendering
            text = message.Text,
            time = message.CreatedAt.ToString("hh:mm tt"),
            type = message.Type
        };

        await hubContext.Clients.Group($"chat-{request.ChatId}").SendAsync("ReceiveMessage", signalRMessage);

        var response = new
        {
            id = message.Id,
            chatId = message.ChatId,
            senderId = "me",
            text = message.Text,
            time = message.CreatedAt.ToString("hh:mm tt"),
            type = message.Type
        };

        return new JsonResult(ApiResponse<object>.SuccessResponse(response));
    }
}

public class CreateChatRequest
{
    public Guid UserId { get; set; }
}

public class SendMessageRequest
{
    public Guid ChatId { get; set; }
    public string Text { get; set; } = string.Empty;
}
