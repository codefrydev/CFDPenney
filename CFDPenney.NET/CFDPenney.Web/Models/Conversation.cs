namespace CFDPenney.Web.Models;

public class Conversation
{
    public string Id { get; set; } = string.Empty;
    public ConversationType Type { get; set; }
    public string Name { get; set; } = string.Empty; // For group chats, custom name; for 1-on-1, other user's name
    public string? Description { get; set; }
    public List<ConversationParticipant> Participants { get; set; } = new();
    public string? LastMessageId { get; set; }
    public DateTime? LastMessageAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public string? CreatedById { get; set; }
    public Dictionary<string, int> UnreadCounts { get; set; } = new(); // userId -> unread count
}

public enum ConversationType
{
    Personal = 1,  // 1-on-1 chat
    Group = 2      // Group chat
}
