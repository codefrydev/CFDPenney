using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;
using CFDPenney.Web.Services;
using CFDPenney.Web.Models;
using System.Security.Claims;

namespace CFDPenney.Web.Pages;

[Authorize]
public class ChatModel : PageModel
{
    private readonly IChatService _chatService;
    private readonly IUserService _userService;
    private readonly IPresenceService _presenceService;

    public ChatModel(IChatService chatService, IUserService userService, IPresenceService presenceService)
    {
        _chatService = chatService;
        _userService = userService;
        _presenceService = presenceService;
    }

    public string? CurrentUserId { get; set; }
    public string? CurrentUserName { get; set; }
    public string? CurrentUserDisplayName { get; set; }
    public List<ConversationViewModel> Conversations { get; set; } = new();
    public ConversationViewModel? SelectedConversation { get; set; }
    public List<MessageViewModel>? Messages { get; set; }
    public List<UserViewModel> AllUsers { get; set; } = new();

    public void OnGet(string? conversationId = null)
    {
        if (User.Identity?.IsAuthenticated != true)
        {
            return;
        }

        CurrentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        CurrentUserName = User.FindFirst(ClaimTypes.Name)?.Value;
        CurrentUserDisplayName = User.FindFirst(ClaimTypes.Name)?.Value;

        if (string.IsNullOrEmpty(CurrentUserId))
            return;

        // Load user's conversations
        var conversations = _chatService.GetUserConversations(CurrentUserId);
        Conversations = conversations.Select(c => MapToConversationViewModel(c, CurrentUserId)).ToList();

        // Load selected conversation if provided
        if (!string.IsNullOrEmpty(conversationId))
        {
            var conversation = _chatService.GetConversation(conversationId);
            if (conversation != null && conversation.Participants.Any(p => p.UserId == CurrentUserId))
            {
                SelectedConversation = MapToConversationViewModel(conversation, CurrentUserId);
                Messages = _chatService.GetMessages(conversationId, 0, 50)
                    .Select(m => MapToMessageViewModel(m, CurrentUserId))
                    .ToList();
            }
        }

        // Load all users for search
        AllUsers = _userService.GetAllUsers()
            .Where(u => u.Id.ToString() != CurrentUserId)
            .Select(u => new UserViewModel
            {
                Id = u.Id.ToString(),
                Username = u.Username,
                DisplayName = u.DisplayName ?? u.Username,
                Email = u.Email,
                Status = u.Status,
                Presence = MapToPresenceViewModel(_presenceService.GetPresence(u.Id.ToString()))
            })
            .ToList();
    }

    private ConversationViewModel MapToConversationViewModel(Conversation conversation, string currentUserId)
    {
        var otherParticipant = conversation.Participants.FirstOrDefault(p => p.UserId != currentUserId);
        var otherUser = otherParticipant != null ? _userService.GetUserById(otherParticipant.UserId) : null;
        var otherPresence = otherParticipant != null ? _presenceService.GetPresence(otherParticipant.UserId) : null;

        return new ConversationViewModel
        {
            Id = conversation.Id,
            Type = conversation.Type,
            Name = conversation.Type == ConversationType.Personal && otherUser != null
                ? (otherUser.DisplayName ?? otherUser.Username)
                : conversation.Name,
            Description = conversation.Description,
            LastMessage = conversation.LastMessageId != null
                ? MapToMessageViewModel(_chatService.GetMessage(conversation.LastMessageId)!, currentUserId)
                : null,
            LastMessageAt = conversation.LastMessageAt,
            CreatedAt = conversation.CreatedAt,
            UpdatedAt = conversation.UpdatedAt,
            Participants = conversation.Participants.Select(p => new ParticipantViewModel
            {
                UserId = p.UserId,
                Role = p.Role,
                JoinedAt = p.JoinedAt,
                User = new UserViewModel
                {
                    Id = p.UserId,
                    Username = _userService.GetUserById(p.UserId)?.Username ?? "Unknown",
                    DisplayName = _userService.GetUserById(p.UserId)?.DisplayName ?? "Unknown",
                    Email = _userService.GetUserById(p.UserId)?.Email,
                    Presence = MapToPresenceViewModel(_presenceService.GetPresence(p.UserId))
                }
            }).ToList(),
            UnreadCount = conversation.UnreadCounts.ContainsKey(currentUserId) ? conversation.UnreadCounts[currentUserId] : 0
        };
    }

    private MessageViewModel MapToMessageViewModel(Message message, string currentUserId)
    {
        var sender = _userService.GetUserById(message.SenderId);
        return new MessageViewModel
        {
            Id = message.Id,
            ConversationId = message.ConversationId,
            SenderId = message.SenderId,
            SenderName = message.SenderName ?? sender?.DisplayName ?? sender?.Username ?? "Unknown",
            Content = message.Content,
            Type = message.Type,
            Timestamp = message.Timestamp,
            EditedAt = message.EditedAt,
            Reactions = message.Reactions.Select(r => new ReactionViewModel
            {
                Emoji = r.Emoji,
                UserId = r.UserId,
                UserName = r.UserName,
                Timestamp = r.Timestamp
            }).ToList(),
            ReadBy = message.ReadBy,
            File = message.File != null ? new FileViewModel
            {
                Name = message.File.Name,
                Type = message.File.Type,
                Size = message.File.Size,
                Data = message.File.Data
            } : null,
            IsOwn = message.SenderId == currentUserId
        };
    }

    private PresenceViewModel? MapToPresenceViewModel(UserPresence? presence)
    {
        if (presence == null) return null;
        return new PresenceViewModel
        {
            UserId = presence.UserId,
            Status = presence.Status,
            LastSeen = presence.LastSeen,
            StatusMessage = presence.StatusMessage
        };
    }
}

// View Models
public class ConversationViewModel
{
    public string Id { get; set; } = string.Empty;
    public ConversationType Type { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public MessageViewModel? LastMessage { get; set; }
    public DateTime? LastMessageAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<ParticipantViewModel> Participants { get; set; } = new();
    public int UnreadCount { get; set; }
}

public class ParticipantViewModel
{
    public string UserId { get; set; } = string.Empty;
    public ParticipantRole Role { get; set; }
    public DateTime JoinedAt { get; set; }
    public UserViewModel User { get; set; } = new();
}

public class MessageViewModel
{
    public string Id { get; set; } = string.Empty;
    public string ConversationId { get; set; } = string.Empty;
    public string SenderId { get; set; } = string.Empty;
    public string SenderName { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public MessageType Type { get; set; }
    public DateTime Timestamp { get; set; }
    public DateTime? EditedAt { get; set; }
    public List<ReactionViewModel> Reactions { get; set; } = new();
    public List<string> ReadBy { get; set; } = new();
    public FileViewModel? File { get; set; }
    public bool IsOwn { get; set; }
}

public class ReactionViewModel
{
    public string Emoji { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string? UserName { get; set; }
    public DateTime Timestamp { get; set; }
}

public class FileViewModel
{
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public long Size { get; set; }
    public string Data { get; set; } = string.Empty;
}

public class UserViewModel
{
    public string Id { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Status { get; set; }
    public PresenceViewModel? Presence { get; set; }

    public string GetInitials()
    {
        if (string.IsNullOrEmpty(DisplayName)) return Username.Substring(0, Math.Min(2, Username.Length)).ToUpper();
        var parts = DisplayName.Split(' ');
        if (parts.Length >= 2)
            return (parts[0][0] + parts[1][0]).ToString().ToUpper();
        return DisplayName.Substring(0, Math.Min(2, DisplayName.Length)).ToUpper();
    }

    public string GetAvatarColor()
    {
        var colors = new[] { "#FF3B30", "#FF9500", "#FFCC00", "#4CD964", "#5AC8FA", "#007AFF", "#5856D6", "#AF52DE", "#FF2D55", "#FF6B6B" };
        var hash = 0;
        foreach (var c in Id)
            hash = c + ((hash << 5) - hash);
        return colors[Math.Abs(hash) % colors.Length];
    }
}

public class PresenceViewModel
{
    public string UserId { get; set; } = string.Empty;
    public PresenceStatus Status { get; set; }
    public DateTime LastSeen { get; set; }
    public string? StatusMessage { get; set; }

    public string GetStatusClass()
    {
        return Status switch
        {
            PresenceStatus.Online => "online",
            PresenceStatus.Away => "away",
            PresenceStatus.Busy => "busy",
            PresenceStatus.DoNotDisturb => "dnd",
            _ => "offline"
        };
    }
}
