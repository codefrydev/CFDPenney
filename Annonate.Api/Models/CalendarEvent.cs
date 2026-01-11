namespace Annonate.Api.Models;

public class CalendarEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime Start { get; set; }
    public DateTime End { get; set; }
    public string Color { get; set; } = "#5b5fc7";
    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public User Creator { get; set; } = null!;
    public ICollection<CalendarEventAttendee> Attendees { get; set; } = new List<CalendarEventAttendee>();
}

public class CalendarEventAttendee
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid EventId { get; set; }
    public Guid UserId { get; set; }
    public string Status { get; set; } = "pending"; // pending, accepted, declined

    // Navigation properties
    public CalendarEvent Event { get; set; } = null!;
    public User User { get; set; } = null!;
}
