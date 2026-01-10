namespace CFDPenney.Web.Models;

public class Message
{
    public string Id { get; set; } = string.Empty;
    public string ConversationId { get; set; } = string.Empty;
    public string SenderId { get; set; } = string.Empty;
    public string? SenderName { get; set; }
    public string Content { get; set; } = string.Empty;
    public MessageType Type { get; set; } = MessageType.Text;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public DateTime? EditedAt { get; set; }
    public List<MessageReaction> Reactions { get; set; } = new();
    public List<string> ReadBy { get; set; } = new(); // User IDs who have read this message
    public string? ThreadParentId { get; set; } // For threaded replies
    public List<Message>? ThreadReplies { get; set; } // Replies to this message
    public MessageFile? File { get; set; } // For file attachments
}

public enum MessageType
{
    Text = 1,
    File = 2,
    System = 3, // System messages like "User joined"
    Call = 4   // Call start/end notifications
}

public class MessageReaction
{
    public string Emoji { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string? UserName { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

public class MessageFile
{
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public long Size { get; set; }
    public string Data { get; set; } = string.Empty; // Base64 encoded
}
