namespace Annonate.Api.Models;

public class Call
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid InitiatorId { get; set; }
    public Guid? ChatId { get; set; }
    public string Type { get; set; } = "audio"; // audio, video
    public string Status { get; set; } = "completed"; // completed, missed, cancelled
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? EndedAt { get; set; }
    public int? Duration { get; set; } // in seconds

    // Navigation properties
    public User Initiator { get; set; } = null!;
    public Chat? Chat { get; set; }
    public ICollection<CallParticipant> Participants { get; set; } = new List<CallParticipant>();
}

public class CallParticipant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CallId { get; set; }
    public Guid UserId { get; set; }
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LeftAt { get; set; }

    // Navigation properties
    public Call Call { get; set; } = null!;
    public User User { get; set; } = null!;
}
