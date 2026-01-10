using CFDPenney.Web.Models;
using System.Collections.Concurrent;

namespace CFDPenney.Web.Services;

public interface IChatService
{
    Conversation CreateConversation(ConversationType type, string createdById, string? name = null, List<string>? participantIds = null);
    Conversation? GetConversation(string conversationId);
    List<Conversation> GetUserConversations(string userId);
    Conversation? GetPersonalConversation(string userId1, string userId2);
    bool AddParticipant(string conversationId, string userId, ParticipantRole role = ParticipantRole.Member);
    bool RemoveParticipant(string conversationId, string userId);
    Message SendMessage(string conversationId, string senderId, string content, MessageType type = MessageType.Text, MessageFile? file = null);
    Message? GetMessage(string messageId);
    List<Message> GetMessages(string conversationId, int skip = 0, int take = 50);
    bool EditMessage(string messageId, string newContent);
    bool DeleteMessage(string messageId);
    bool AddReaction(string messageId, string userId, string emoji);
    bool RemoveReaction(string messageId, string userId, string emoji);
    bool MarkAsRead(string messageId, string userId);
    void MarkConversationAsRead(string conversationId, string userId);
    List<Message> SearchMessages(string userId, string query, int maxResults = 50);
}

public class ChatService : IChatService
{
    private readonly ConcurrentDictionary<string, Conversation> _conversations = new();
    private readonly ConcurrentDictionary<string, Message> _messages = new();
    private readonly ConcurrentDictionary<string, List<string>> _conversationMessages = new(); // conversationId -> messageIds
    private readonly ConcurrentDictionary<string, string> _personalConversations = new(); // "userId1:userId2" -> conversationId
    private readonly IUserService _userService;

    public ChatService(IUserService userService)
    {
        _userService = userService;
        InitializeMockData();
    }

    private void InitializeMockData()
    {
        // Get all users
        var allUsers = _userService.GetAllUsers();
        if (allUsers.Count < 2) return; // Need at least 2 users for mock data

        var user1 = allUsers[0];
        var user2 = allUsers[1];
        var user3 = allUsers.Count > 2 ? allUsers[2] : null;

        // Create a personal conversation between user1 and user2
        var personalConv = CreateConversation(
            ConversationType.Personal,
            user1.Id.ToString(),
            null,
            new List<string> { user2.Id.ToString() }
        );

        // Add some messages to personal conversation
        var msg1 = SendMessage(personalConv.Id, user1.Id.ToString(), "Hey! How are you doing?");
        var msg2 = SendMessage(personalConv.Id, user2.Id.ToString(), "I'm doing great, thanks! How about you?");
        var msg3 = SendMessage(personalConv.Id, user1.Id.ToString(), "Pretty good! Working on a new project.");
        var msg4 = SendMessage(personalConv.Id, user2.Id.ToString(), "That sounds exciting! Tell me more about it.");
        
        // Add a reaction
        AddReaction(msg1.Id, user2.Id.ToString(), "👍");
        AddReaction(msg3.Id, user2.Id.ToString(), "🔥");
        
        // Mark some messages as read
        MarkAsRead(msg1.Id, user2.Id.ToString());
        MarkAsRead(msg2.Id, user1.Id.ToString());
        MarkAsRead(msg3.Id, user2.Id.ToString());

        // Create a group conversation if we have 3+ users
        if (user3 != null)
        {
            var groupConv = CreateConversation(
                ConversationType.Group,
                user1.Id.ToString(),
                "Project Team",
                new List<string> { user2.Id.ToString(), user3.Id.ToString() }
            );

            // Add some messages to group conversation
            var groupMsg1 = SendMessage(groupConv.Id, user1.Id.ToString(), "Welcome to the project team chat!");
            var groupMsg2 = SendMessage(groupConv.Id, user2.Id.ToString(), "Thanks for adding me! Looking forward to working together.");
            var groupMsg3 = SendMessage(groupConv.Id, user3.Id.ToString(), "Same here! Let's make this project awesome! 🚀");
            var groupMsg4 = SendMessage(groupConv.Id, user1.Id.ToString(), "Great! Let's schedule a meeting to discuss the roadmap.");
            var groupMsg5 = SendMessage(groupConv.Id, user2.Id.ToString(), "Sounds good. I'm available tomorrow afternoon.");
            
            // Add reactions to group messages
            AddReaction(groupMsg1.Id, user2.Id.ToString(), "👍");
            AddReaction(groupMsg1.Id, user3.Id.ToString(), "👏");
            AddReaction(groupMsg3.Id, user1.Id.ToString(), "🔥");
            AddReaction(groupMsg3.Id, user2.Id.ToString(), "🚀");
            
            // Mark messages as read
            MarkAsRead(groupMsg1.Id, user2.Id.ToString());
            MarkAsRead(groupMsg1.Id, user3.Id.ToString());
            MarkAsRead(groupMsg2.Id, user1.Id.ToString());
            MarkAsRead(groupMsg2.Id, user3.Id.ToString());
            MarkAsRead(groupMsg3.Id, user1.Id.ToString());
            MarkAsRead(groupMsg3.Id, user2.Id.ToString());
        }

        // Create another personal conversation between user1 and user3 (if exists)
        if (user3 != null)
        {
            var personalConv2 = CreateConversation(
                ConversationType.Personal,
                user1.Id.ToString(),
                null,
                new List<string> { user3.Id.ToString() }
            );

            var msg5 = SendMessage(personalConv2.Id, user1.Id.ToString(), "Hi! Quick question about the project.");
            var msg6 = SendMessage(personalConv2.Id, user3.Id.ToString(), "Sure, what's up?");
            var msg7 = SendMessage(personalConv2.Id, user1.Id.ToString(), "Can you review the latest changes?");
            
            MarkAsRead(msg5.Id, user3.Id.ToString());
            MarkAsRead(msg6.Id, user1.Id.ToString());
        }
    }

    public Conversation CreateConversation(ConversationType type, string createdById, string? name = null, List<string>? participantIds = null)
    {
        var conversationId = Guid.NewGuid().ToString();
        var participants = new List<ConversationParticipant>
        {
            new ConversationParticipant
            {
                UserId = createdById,
                ConversationId = conversationId,
                Role = ParticipantRole.Owner,
                JoinedAt = DateTime.UtcNow
            }
        };

        if (participantIds != null)
        {
            foreach (var participantId in participantIds.Where(id => id != createdById))
            {
                participants.Add(new ConversationParticipant
                {
                    UserId = participantId,
                    ConversationId = conversationId,
                    Role = ParticipantRole.Member,
                    JoinedAt = DateTime.UtcNow
                });
            }
        }

        var conversation = new Conversation
        {
            Id = conversationId,
            Type = type,
            Name = name ?? GetDefaultConversationName(type, participants, createdById),
            Participants = participants,
            CreatedById = createdById,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            UnreadCounts = new Dictionary<string, int>()
        };

        _conversations[conversationId] = conversation;
        _conversationMessages[conversationId] = new List<string>();

        // For personal conversations, store the mapping
        if (type == ConversationType.Personal && participants.Count == 2)
        {
            var userIds = participants.Select(p => p.UserId).OrderBy(id => id).ToList();
            var key = $"{userIds[0]}:{userIds[1]}";
            _personalConversations[key] = conversationId;
        }

        return conversation;
    }

    public Conversation? GetConversation(string conversationId)
    {
        _conversations.TryGetValue(conversationId, out var conversation);
        return conversation;
    }

    public List<Conversation> GetUserConversations(string userId)
    {
        return _conversations.Values
            .Where(c => c.Participants.Any(p => p.UserId == userId))
            .OrderByDescending(c => c.LastMessageAt ?? c.UpdatedAt)
            .ToList();
    }

    public Conversation? GetPersonalConversation(string userId1, string userId2)
    {
        var userIds = new[] { userId1, userId2 }.OrderBy(id => id).ToList();
        var key = $"{userIds[0]}:{userIds[1]}";
        
        if (_personalConversations.TryGetValue(key, out var conversationId))
        {
            return GetConversation(conversationId);
        }
        return null;
    }

    public bool AddParticipant(string conversationId, string userId, ParticipantRole role = ParticipantRole.Member)
    {
        if (!_conversations.TryGetValue(conversationId, out var conversation))
            return false;

        if (conversation.Participants.Any(p => p.UserId == userId))
            return true; // Already a participant

        conversation.Participants.Add(new ConversationParticipant
        {
            UserId = userId,
            ConversationId = conversationId,
            Role = role,
            JoinedAt = DateTime.UtcNow
        });

        conversation.UpdatedAt = DateTime.UtcNow;
        return true;
    }

    public bool RemoveParticipant(string conversationId, string userId)
    {
        if (!_conversations.TryGetValue(conversationId, out var conversation))
            return false;

        var participant = conversation.Participants.FirstOrDefault(p => p.UserId == userId);
        if (participant == null)
            return false;

        conversation.Participants.Remove(participant);
        conversation.UpdatedAt = DateTime.UtcNow;
        return true;
    }

    public Message SendMessage(string conversationId, string senderId, string content, MessageType type = MessageType.Text, MessageFile? file = null)
    {
        if (!_conversations.TryGetValue(conversationId, out var conversation))
            throw new ArgumentException("Conversation not found");

        if (!conversation.Participants.Any(p => p.UserId == senderId))
            throw new UnauthorizedAccessException("User is not a participant");

        var user = _userService.GetUserById(senderId);
        var messageId = Guid.NewGuid().ToString();
        var message = new Message
        {
            Id = messageId,
            ConversationId = conversationId,
            SenderId = senderId,
            SenderName = user?.DisplayName ?? user?.Username ?? "Unknown",
            Content = content,
            Type = type,
            Timestamp = DateTime.UtcNow,
            File = file,
            ReadBy = new List<string> { senderId } // Sender has read their own message
        };

        _messages[messageId] = message;
        
        if (!_conversationMessages.TryGetValue(conversationId, out var messageIds))
        {
            messageIds = new List<string>();
            _conversationMessages[conversationId] = messageIds;
        }
        messageIds.Add(messageId);

        // Update conversation
        conversation.LastMessageId = messageId;
        conversation.LastMessageAt = message.Timestamp;
        conversation.UpdatedAt = DateTime.UtcNow;

        // Increment unread counts for all participants except sender
        foreach (var participant in conversation.Participants.Where(p => p.UserId != senderId))
        {
            if (!conversation.UnreadCounts.ContainsKey(participant.UserId))
                conversation.UnreadCounts[participant.UserId] = 0;
            conversation.UnreadCounts[participant.UserId]++;
        }

        return message;
    }

    public Message? GetMessage(string messageId)
    {
        _messages.TryGetValue(messageId, out var message);
        return message;
    }

    public List<Message> GetMessages(string conversationId, int skip = 0, int take = 50)
    {
        if (!_conversationMessages.TryGetValue(conversationId, out var messageIds))
            return new List<Message>();

        return messageIds
            .Skip(skip)
            .Take(take)
            .Select(id => _messages.TryGetValue(id, out var msg) ? msg : null)
            .Where(msg => msg != null)
            .OrderBy(msg => msg!.Timestamp)
            .ToList()!;
    }

    public bool EditMessage(string messageId, string newContent)
    {
        if (!_messages.TryGetValue(messageId, out var message))
            return false;

        message.Content = newContent;
        message.EditedAt = DateTime.UtcNow;
        return true;
    }

    public bool DeleteMessage(string messageId)
    {
        if (!_messages.TryGetValue(messageId, out var message))
            return false;

        // Remove from conversation's message list
        if (_conversationMessages.TryGetValue(message.ConversationId, out var messageIds))
        {
            messageIds.Remove(messageId);
        }

        return _messages.TryRemove(messageId, out _);
    }

    public bool AddReaction(string messageId, string userId, string emoji)
    {
        if (!_messages.TryGetValue(messageId, out var message))
            return false;

        // Remove existing reaction from this user for this emoji
        message.Reactions.RemoveAll(r => r.UserId == userId && r.Emoji == emoji);
        
        // Add new reaction
        var user = _userService.GetUserById(userId);
        message.Reactions.Add(new MessageReaction
        {
            Emoji = emoji,
            UserId = userId,
            UserName = user?.DisplayName ?? user?.Username ?? "Unknown",
            Timestamp = DateTime.UtcNow
        });

        return true;
    }

    public bool RemoveReaction(string messageId, string userId, string emoji)
    {
        if (!_messages.TryGetValue(messageId, out var message))
            return false;

        return message.Reactions.RemoveAll(r => r.UserId == userId && r.Emoji == emoji) > 0;
    }

    public bool MarkAsRead(string messageId, string userId)
    {
        if (!_messages.TryGetValue(messageId, out var message))
            return false;

        if (!message.ReadBy.Contains(userId))
        {
            message.ReadBy.Add(userId);
        }

        // Update conversation unread count
        if (_conversations.TryGetValue(message.ConversationId, out var conversation))
        {
            if (conversation.UnreadCounts.ContainsKey(userId) && conversation.UnreadCounts[userId] > 0)
            {
                conversation.UnreadCounts[userId]--;
            }
        }

        return true;
    }

    public void MarkConversationAsRead(string conversationId, string userId)
    {
        if (!_conversationMessages.TryGetValue(conversationId, out var messageIds))
            return;

        foreach (var messageId in messageIds)
        {
            MarkAsRead(messageId, userId);
        }

        if (_conversations.TryGetValue(conversationId, out var conversation))
        {
            conversation.UnreadCounts[userId] = 0;
        }
    }

    public List<Message> SearchMessages(string userId, string query, int maxResults = 50)
    {
        var userConversations = GetUserConversations(userId).Select(c => c.Id).ToHashSet();
        
        return _messages.Values
            .Where(m => userConversations.Contains(m.ConversationId) && 
                       m.Content.Contains(query, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(m => m.Timestamp)
            .Take(maxResults)
            .ToList();
    }

    private string GetDefaultConversationName(ConversationType type, List<ConversationParticipant> participants, string createdById)
    {
        if (type == ConversationType.Personal && participants.Count == 2)
        {
            var otherParticipant = participants.FirstOrDefault(p => p.UserId != createdById);
            if (otherParticipant != null)
            {
                var user = _userService.GetUserById(otherParticipant.UserId);
                return user?.DisplayName ?? user?.Username ?? "Unknown User";
            }
        }
        return "Group Chat";
    }
}
