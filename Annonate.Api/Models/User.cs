namespace Annonate.Api.Models;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string? Role { get; set; }
    public string Status { get; set; } = "available"; // available, busy, away, offline
    public string Avatar { get; set; } = string.Empty;
    public string? StatusMessage { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastSeen { get; set; }

    // Navigation properties
    public ICollection<Chat> Chats { get; set; } = new List<Chat>();
    public ICollection<Message> Messages { get; set; } = new List<Message>();
    public ICollection<TeamMember> TeamMemberships { get; set; } = new List<TeamMember>();
    public ICollection<CalendarEvent> CalendarEvents { get; set; } = new List<CalendarEvent>();
}
