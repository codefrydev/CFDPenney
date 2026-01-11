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
public class ChatsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ChatsController> _logger;

    public ChatsController(ApplicationDbContext context, ILogger<ChatsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<object>>>> GetChats()
    {
        // TEMPORARY: Use default userId when auth is disabled
        var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier);
        var userId = userIdClaim != null ? Guid.Parse(userIdClaim.Value) : Guid.Parse("00000000-0000-0000-0000-000000000001");

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
                isGroup = c.IsGroup,
                messages = c.Messages.OrderBy(m => m.CreatedAt).Select(m => new
                {
                    id = m.Id,
                    senderId = m.SenderId,
                    text = m.Text,
                    time = m.CreatedAt.ToString("hh:mm tt"),
                    type = m.Type
                }).ToList()
            };
        }).ToList();

        return Ok(ApiResponse<List<object>>.SuccessResponse(chatResults.Cast<object>().ToList()));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<object>>> GetChat(Guid id)
    {
        // TEMPORARY: Use default userId when auth is disabled
        var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier);
        var userId = userIdClaim != null ? Guid.Parse(userIdClaim.Value) : Guid.Parse("00000000-0000-0000-0000-000000000001");

        var chat = await _context.Chats
            .Include(c => c.Members)
                .ThenInclude(m => m.User)
            .Include(c => c.Messages.OrderBy(m => m.CreatedAt))
            .Where(c => c.Id == id && c.Members.Any(m => m.UserId == userId))
            .FirstOrDefaultAsync();

        if (chat == null)
        {
            return NotFound(ApiResponse<object>.ErrorResponse("Chat not found"));
        }

        var otherMember = chat.Members.FirstOrDefault(m => m.UserId != userId);
        var currentMember = chat.Members.FirstOrDefault(m => m.UserId == userId);
        var lastMessage = chat.Messages.OrderByDescending(m => m.CreatedAt).FirstOrDefault();

        var chatResult = new
        {
            id = chat.Id,
            userId = otherMember?.UserId ?? Guid.Empty,
            lastMessage = lastMessage?.Text ?? "",
            timestamp = lastMessage != null ? lastMessage.CreatedAt.ToString("hh:mm tt") : "",
            unread = currentMember?.UnreadCount ?? 0,
            isGroup = chat.IsGroup,
            messages = chat.Messages.OrderBy(m => m.CreatedAt).Select(m => new
            {
                id = m.Id,
                senderId = m.SenderId,
                text = m.Text,
                time = m.CreatedAt.ToString("hh:mm tt"),
                type = m.Type
            }).ToList()
        };

        return Ok(ApiResponse<object>.SuccessResponse(chatResult));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<object>>> CreateChat([FromBody] CreateChatRequest request)
    {
        try
        {
            // 1. Request validation
            if (request == null)
            {
                _logger.LogWarning("CreateChat: Request is null");
                return BadRequest(ApiResponse<object>.ErrorResponse("Request body is required"));
            }

            if (request.UserId == Guid.Empty)
            {
                _logger.LogWarning("CreateChat: UserId is empty");
                return BadRequest(ApiResponse<object>.ErrorResponse("UserId is required and cannot be empty"));
            }

            // TEMPORARY: Use default userId when auth is disabled
            var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier);
            var userId = userIdClaim != null ? Guid.Parse(userIdClaim.Value) : Guid.Parse("00000000-0000-0000-0000-000000000001");

            // 1. Verify the current user exists (CRITICAL - prevents FOREIGN KEY constraint failure)
            var currentUserExists = await _context.Users.AnyAsync(u => u.Id == userId);
            if (!currentUserExists)
            {
                _logger.LogWarning("CreateChat: Current user does not exist. UserId: {UserId}", userId);
                return Unauthorized(ApiResponse<object>.ErrorResponse("Current user not found. Please log in again."));
            }

            // 2. Prevent self-chat creation
            if (userId == request.UserId)
            {
                _logger.LogWarning("CreateChat: User attempted to create chat with themselves. UserId: {UserId}", userId);
                return BadRequest(ApiResponse<object>.ErrorResponse("Cannot create a chat with yourself"));
            }

            // 3. Verify the requested user exists (CRITICAL - prevents FOREIGN KEY constraint failure)
            var targetUserExists = await _context.Users.AnyAsync(u => u.Id == request.UserId);
            if (!targetUserExists)
            {
                _logger.LogWarning("CreateChat: Requested user does not exist. UserId: {UserId}, RequestedUserId: {RequestedUserId}", userId, request.UserId);
                return NotFound(ApiResponse<object>.ErrorResponse($"User with ID {request.UserId} not found"));
            }

            // Check if chat already exists between these two users
            var existingChat = await _context.Chats
                .Include(c => c.Members)
                .Where(c => !c.IsGroup && 
                           c.Members.Any(m => m.UserId == userId) && 
                           c.Members.Any(m => m.UserId == request.UserId))
                .FirstOrDefaultAsync();

            if (existingChat != null)
            {
                // Return existing chat
                var otherMember = existingChat.Members.FirstOrDefault(m => m.UserId != userId);
                var currentMember = existingChat.Members.FirstOrDefault(m => m.UserId == userId);

                if (otherMember == null || currentMember == null)
                {
                    _logger.LogError("CreateChat: Existing chat found but members are missing. ChatId: {ChatId}", existingChat.Id);
                    return StatusCode(500, ApiResponse<object>.ErrorResponse("Error retrieving existing chat"));
                }

                var chat = new
                {
                    id = existingChat.Id,
                    userId = otherMember.UserId,
                    lastMessage = "",
                    timestamp = "",
                    unread = currentMember.UnreadCount,
                    isGroup = existingChat.IsGroup,
                    messages = new List<object>()
                };

                return Ok(ApiResponse<object>.SuccessResponse(chat));
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

            // Add members
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

            // Return the new chat with safe LINQ queries
            var createdChatMembers = await _context.ChatMembers
                .Include(m => m.User)
                .Where(m => m.ChatId == newChat.Id)
                .ToListAsync();

            var otherMemberCreated = createdChatMembers.FirstOrDefault(m => m.UserId != userId);
            var currentMemberCreated = createdChatMembers.FirstOrDefault(m => m.UserId == userId);

            if (otherMemberCreated == null || currentMemberCreated == null)
            {
                _logger.LogError("CreateChat: Chat created but members are missing. ChatId: {ChatId}", newChat.Id);
                return StatusCode(500, ApiResponse<object>.ErrorResponse("Error retrieving created chat"));
            }

            var createdChat = new
            {
                id = newChat.Id,
                userId = otherMemberCreated.UserId,
                lastMessage = "",
                timestamp = "",
                unread = 0,
                isGroup = newChat.IsGroup,
                messages = new List<object>()
            };

            return Ok(ApiResponse<object>.SuccessResponse(createdChat));
        }
        catch (DbUpdateException dbEx)
        {
            _logger.LogError(dbEx, "CreateChat: Database error occurred. UserId: {UserId}, RequestedUserId: {RequestedUserId}", 
                User?.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "default", request?.UserId);
            return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred while creating the chat. Please try again."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "CreateChat: Unexpected error occurred. UserId: {UserId}, RequestedUserId: {RequestedUserId}", 
                User?.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "default", request?.UserId);
            return StatusCode(500, ApiResponse<object>.ErrorResponse("An unexpected error occurred. Please try again."));
        }
    }
}

public class CreateChatRequest
{
    public Guid UserId { get; set; }
}
