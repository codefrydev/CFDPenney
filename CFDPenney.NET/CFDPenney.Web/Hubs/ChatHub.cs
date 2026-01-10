using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authorization;
using CFDPenney.Web.Models;
using CFDPenney.Web.Services;
using System.Security.Claims;

namespace CFDPenney.Web.Hubs;

[Authorize]
public class ChatHub : Hub
{
    private readonly IChatService _chatService;
    private readonly IPresenceService _presenceService;
    private readonly ICallService _callService;
    private readonly IUserService _userService;
    private readonly ILogger<ChatHub> _logger;

    public ChatHub(
        IChatService chatService,
        IPresenceService presenceService,
        ICallService callService,
        IUserService userService,
        ILogger<ChatHub> logger)
    {
        _chatService = chatService;
        _presenceService = presenceService;
        _callService = callService;
        _userService = userService;
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
        {
            Context.Abort();
            return;
        }

        _presenceService.SetOnline(userId);
        
        // Notify others that user is online
        await Clients.Others.SendAsync("UserPresenceChanged", new
        {
            UserId = userId,
            Status = PresenceStatus.Online,
            LastSeen = DateTime.UtcNow
        });

        // Send user's conversations
        var conversations = _chatService.GetUserConversations(userId);
        await Clients.Caller.SendAsync("ConversationsLoaded", conversations.Select(c => new
        {
            c.Id,
            c.Type,
            c.Name,
            c.Description,
            LastMessage = c.LastMessageId != null ? GetMessageDto(_chatService.GetMessage(c.LastMessageId)) : null,
            c.LastMessageAt,
            c.CreatedAt,
            c.UpdatedAt,
            Participants = c.Participants.Select(p => new
            {
                p.UserId,
                p.Role,
                p.JoinedAt,
                User = GetUserDto(_userService.GetUserById(p.UserId)),
                Presence = GetPresenceDto(_presenceService.GetPresence(p.UserId))
            }),
            UnreadCount = c.UnreadCounts.ContainsKey(userId) ? c.UnreadCounts[userId] : 0
        }));

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = GetUserId();
        if (!string.IsNullOrEmpty(userId))
        {
            _presenceService.SetOffline(userId);
            
            // Notify others that user is offline
            await Clients.Others.SendAsync("UserPresenceChanged", new
            {
                UserId = userId,
                Status = PresenceStatus.Offline,
                LastSeen = DateTime.UtcNow
            });
        }

        await base.OnDisconnectedAsync(exception);
    }

    // Conversation Management
    public async Task<string> CreateConversation(ConversationType type, string? name = null, List<string>? participantIds = null)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
            throw new UnauthorizedAccessException();

        var conversation = _chatService.CreateConversation(type, userId, name, participantIds);
        
        // Add all participants to SignalR group
        foreach (var participant in conversation.Participants)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, conversation.Id);
        }

        // Send updated conversations list to all participants
        foreach (var participant in conversation.Participants)
        {
            var userConversations = _chatService.GetUserConversations(participant.UserId);
            await Clients.User(participant.UserId).SendAsync("ConversationsLoaded", userConversations.Select(c => new
            {
                c.Id,
                c.Type,
                c.Name,
                c.Description,
                LastMessage = c.LastMessageId != null ? GetMessageDto(_chatService.GetMessage(c.LastMessageId)) : null,
                c.LastMessageAt,
                c.CreatedAt,
                c.UpdatedAt,
                Participants = c.Participants.Select(p => new
                {
                    p.UserId,
                    p.Role,
                    p.JoinedAt,
                    User = GetUserDto(_userService.GetUserById(p.UserId)),
                    Presence = GetPresenceDto(_presenceService.GetPresence(p.UserId))
                }),
                UnreadCount = c.UnreadCounts.ContainsKey(participant.UserId) ? c.UnreadCounts[participant.UserId] : 0
            }));
        }

        return conversation.Id;
    }

    public async Task JoinConversation(string conversationId)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
            return;

        var conversation = _chatService.GetConversation(conversationId);
        if (conversation == null)
            return;

        await Groups.AddToGroupAsync(Context.ConnectionId, conversationId);

        // Send conversation details and message history
        var messages = _chatService.GetMessages(conversationId, 0, 50);
        await Clients.Caller.SendAsync("ConversationJoined", new
        {
            Conversation = new
            {
                conversation.Id,
                conversation.Type,
                conversation.Name,
                conversation.Description,
                Participants = conversation.Participants.Select(p => new
                {
                    p.UserId,
                    p.Role,
                    User = GetUserDto(_userService.GetUserById(p.UserId)),
                    Presence = GetPresenceDto(_presenceService.GetPresence(p.UserId))
                })
            },
            Messages = messages.Select(m => GetMessageDto(m))
        });

        // Mark as read
        _chatService.MarkConversationAsRead(conversationId, userId);
    }

    // Messaging
    public async Task<string> SendMessage(string conversationId, string content, string? fileData = null, string? fileName = null, string? fileType = null)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
            throw new UnauthorizedAccessException();

        MessageFile? file = null;
        if (!string.IsNullOrEmpty(fileData))
        {
            file = new MessageFile
            {
                Name = fileName ?? "file",
                Type = fileType ?? "application/octet-stream",
                Data = fileData,
                Size = 0 // Could calculate from base64
            };
        }

        var message = _chatService.SendMessage(conversationId, userId, content, 
            file != null ? MessageType.File : MessageType.Text, file);

        // Broadcast to all participants in the conversation
        await Clients.Group(conversationId).SendAsync("MessageReceived", GetMessageDto(message));

        // Update conversation list for all participants - send full updated conversations
        var conversation = _chatService.GetConversation(conversationId);
        if (conversation != null)
        {
            // Send updated conversations list to all participants
            foreach (var participant in conversation.Participants)
            {
                var userConversations = _chatService.GetUserConversations(participant.UserId);
                await Clients.User(participant.UserId).SendAsync("ConversationsLoaded", userConversations.Select(c => new
                {
                    c.Id,
                    c.Type,
                    c.Name,
                    c.Description,
                    LastMessage = c.LastMessageId != null ? GetMessageDto(_chatService.GetMessage(c.LastMessageId)) : null,
                    c.LastMessageAt,
                    c.CreatedAt,
                    c.UpdatedAt,
                    Participants = c.Participants.Select(p => new
                    {
                        p.UserId,
                        p.Role,
                        p.JoinedAt,
                        User = GetUserDto(_userService.GetUserById(p.UserId)),
                        Presence = GetPresenceDto(_presenceService.GetPresence(p.UserId))
                    }),
                    UnreadCount = c.UnreadCounts.ContainsKey(participant.UserId) ? c.UnreadCounts[participant.UserId] : 0
                }));
            }
        }

        return message.Id;
    }

    public async Task<bool> EditMessage(string messageId, string newContent)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
            return false;

        var message = _chatService.GetMessage(messageId);
        if (message == null || message.SenderId != userId)
            return false;

        if (_chatService.EditMessage(messageId, newContent))
        {
            message = _chatService.GetMessage(messageId);
            if (message != null)
            {
                await Clients.Group(message.ConversationId).SendAsync("MessageEdited", new
                {
                    message.Id,
                    message.Content,
                    message.EditedAt
                });
                return true;
            }
        }

        return false;
    }

    public async Task<bool> DeleteMessage(string messageId)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
            return false;

        var message = _chatService.GetMessage(messageId);
        if (message == null || message.SenderId != userId)
            return false;

        if (_chatService.DeleteMessage(messageId))
        {
            await Clients.Group(message.ConversationId).SendAsync("MessageDeleted", messageId);
            return true;
        }

        return false;
    }

    public async Task<bool> AddReaction(string messageId, string emoji)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
            return false;

        if (_chatService.AddReaction(messageId, userId, emoji))
        {
            var message = _chatService.GetMessage(messageId);
            if (message != null)
            {
                await Clients.Group(message.ConversationId).SendAsync("ReactionAdded", new
                {
                    MessageId = messageId,
                    Reactions = message.Reactions
                });
                return true;
            }
        }

        return false;
    }

    public async Task<bool> RemoveReaction(string messageId, string emoji)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
            return false;

        if (_chatService.RemoveReaction(messageId, userId, emoji))
        {
            var message = _chatService.GetMessage(messageId);
            if (message != null)
            {
                await Clients.Group(message.ConversationId).SendAsync("ReactionRemoved", new
                {
                    MessageId = messageId,
                    Reactions = message.Reactions
                });
                return true;
            }
        }

        return false;
    }

    public async Task MarkAsRead(string messageId)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
            return;

        if (_chatService.MarkAsRead(messageId, userId))
        {
            var message = _chatService.GetMessage(messageId);
            if (message != null)
            {
                await Clients.Group(message.ConversationId).SendAsync("MessageRead", new
                {
                    MessageId = messageId,
                    ReadBy = message.ReadBy
                });
            }
        }
    }

    public async Task MarkConversationAsRead(string conversationId)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
            return;

        _chatService.MarkConversationAsRead(conversationId, userId);
        
        // Send updated conversations list to user (server manages all state)
        var conversations = _chatService.GetUserConversations(userId);
        await Clients.Caller.SendAsync("ConversationsLoaded", conversations.Select(c => new
        {
            c.Id,
            c.Type,
            c.Name,
            c.Description,
            LastMessage = c.LastMessageId != null ? GetMessageDto(_chatService.GetMessage(c.LastMessageId)) : null,
            c.LastMessageAt,
            c.CreatedAt,
            c.UpdatedAt,
            Participants = c.Participants.Select(p => new
            {
                p.UserId,
                p.Role,
                p.JoinedAt,
                User = GetUserDto(_userService.GetUserById(p.UserId)),
                Presence = GetPresenceDto(_presenceService.GetPresence(p.UserId))
            }),
            UnreadCount = c.UnreadCounts.ContainsKey(userId) ? c.UnreadCounts[userId] : 0
        }));
    }

    // Presence
    public async Task UpdatePresence(PresenceStatus status, string? statusMessage = null)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
            return;

        _presenceService.SetStatus(userId, status, statusMessage);
        await Clients.Others.SendAsync("UserPresenceChanged", new
        {
            UserId = userId,
            Status = status,
            StatusMessage = statusMessage,
            LastSeen = DateTime.UtcNow
        });
    }

    // Calls
    public async Task<string> StartCall(string conversationId, CallType type)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
            throw new UnauthorizedAccessException();

        var call = _callService.StartCall(conversationId, userId, type);
        
        // Notify all participants in the conversation
        await Clients.Group(conversationId).SendAsync("CallStarted", new
        {
            call.Id,
            call.ConversationId,
            call.CallerId,
            call.Type,
            call.Status,
            call.StartedAt,
            Participants = call.Participants.Select(p => new
            {
                p.UserId,
                p.IsMuted,
                p.IsVideoEnabled
            })
        });

        return call.Id;
    }

    public async Task<bool> AnswerCall(string callId)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
            return false;

        var call = _callService.GetCall(callId);
        if (call == null)
            return false;

        if (_callService.AddParticipant(callId, userId))
        {
            call = _callService.GetCall(callId);
            if (call != null)
            {
                await Clients.Group(call.ConversationId).SendAsync("CallAnswered", new
                {
                    CallId = callId,
                    UserId = userId,
                    Participants = call.Participants.Select(p => new
                    {
                        p.UserId,
                        p.IsMuted,
                        p.IsVideoEnabled
                    })
                });
                return true;
            }
        }

        return false;
    }

    public async Task<bool> RejectCall(string callId)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
            return false;

        var call = _callService.GetCall(callId);
        if (call == null)
            return false;

        await Clients.Group(call.ConversationId).SendAsync("CallRejected", new
        {
            CallId = callId,
            UserId = userId
        });

        return true;
    }

    public async Task<bool> EndCall(string callId)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
            return false;

        var call = _callService.GetCall(callId);
        if (call == null)
            return false;

        if (_callService.EndCall(callId))
        {
            await Clients.Group(call.ConversationId).SendAsync("CallEnded", new
            {
                CallId = callId,
                EndedBy = userId
            });
            return true;
        }

        return false;
    }

    public async Task ToggleMute(string callId, bool isMuted)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
            return;

        var call = _callService.GetCall(callId);
        if (call == null)
            return;

        var participant = call.Participants.FirstOrDefault(p => p.UserId == userId);
        if (participant != null)
        {
            participant.IsMuted = isMuted;
            await Clients.Group(call.ConversationId).SendAsync("CallParticipantUpdated", new
            {
                CallId = callId,
                UserId = userId,
                IsMuted = isMuted
            });
        }
    }

    public async Task ToggleVideo(string callId, bool isVideoEnabled)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
            return;

        var call = _callService.GetCall(callId);
        if (call == null)
            return;

        var participant = call.Participants.FirstOrDefault(p => p.UserId == userId);
        if (participant != null)
        {
            participant.IsVideoEnabled = isVideoEnabled;
            await Clients.Group(call.ConversationId).SendAsync("CallParticipantUpdated", new
            {
                CallId = callId,
                UserId = userId,
                IsVideoEnabled = isVideoEnabled
            });
        }
    }

    // Search
    public Task<List<object>> SearchMessages(string query, int maxResults = 50)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Task.FromResult(new List<object>());

        var messages = _chatService.SearchMessages(userId, query, maxResults);
        var result = messages.Select(m => GetMessageDto(m)).Where(m => m != null).Cast<object>().ToList();
        return Task.FromResult(result);
    }

    // User search
    public Task<List<object>> SearchUsers(string query)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Task.FromResult(new List<object>());

        var allUsers = _userService.GetAllUsers();
        var matchingUsers = allUsers
            .Where(u => u.Id.ToString() != userId && 
                   (u.Username.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                    (u.DisplayName?.Contains(query, StringComparison.OrdinalIgnoreCase) ?? false)))
            .Take(20)
            .ToList();

        var result = matchingUsers.Select(u => GetUserDto(u)).Where(u => u != null).Cast<object>().ToList();
        return Task.FromResult(result);
    }

    // Helper methods
    private string? GetUserId()
    {
        var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return userIdClaim; // User ID from claims (should be string representation of int)
    }

    private object? GetMessageDto(Message? message)
    {
        if (message == null)
            return null;

        return new
        {
            message.Id,
            message.ConversationId,
            message.SenderId,
            message.SenderName,
            message.Content,
            message.Type,
            message.Timestamp,
            message.EditedAt,
            message.Reactions,
            message.ReadBy,
            message.ThreadParentId,
            File = message.File != null ? new
            {
                message.File.Name,
                message.File.Type,
                message.File.Size,
                message.File.Data
            } : null
        };
    }

    private object? GetUserDto(User? user)
    {
        if (user == null)
            return null;

        return new
        {
            user.Id,
            user.Username,
            user.DisplayName,
            user.Email,
            user.Avatar,
            user.Status
        };
    }

    private object? GetPresenceDto(UserPresence? presence)
    {
        if (presence == null)
            return null;

        return new
        {
            presence.UserId,
            presence.Status,
            presence.LastSeen,
            presence.StatusMessage
        };
    }
}
