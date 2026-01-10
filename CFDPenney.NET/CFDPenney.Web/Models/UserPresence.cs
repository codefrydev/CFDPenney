namespace CFDPenney.Web.Models;

public class UserPresence
{
    public string UserId { get; set; } = string.Empty;
    public PresenceStatus Status { get; set; } = PresenceStatus.Offline;
    public DateTime LastSeen { get; set; } = DateTime.UtcNow;
    public string? StatusMessage { get; set; } // Custom status like "In a meeting"
}

public enum PresenceStatus
{
    Offline = 0,
    Online = 1,
    Away = 2,
    Busy = 3,
    DoNotDisturb = 4
}
