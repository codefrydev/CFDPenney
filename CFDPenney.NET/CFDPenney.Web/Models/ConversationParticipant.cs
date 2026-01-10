namespace CFDPenney.Web.Models;

public class ConversationParticipant
{
    public string UserId { get; set; } = string.Empty;
    public string ConversationId { get; set; } = string.Empty;
    public ParticipantRole Role { get; set; } = ParticipantRole.Member;
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastReadAt { get; set; }
    public string? DisplayName { get; set; } // Override name for this conversation
}

public enum ParticipantRole
{
    Member = 1,
    Admin = 2,
    Owner = 3
}
