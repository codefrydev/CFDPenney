namespace CFDPenney.Web.Models;

public class Session
{
    public string Code { get; set; } = string.Empty;
    public string HostId { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime LastActivity { get; set; } = DateTime.UtcNow;
    public List<Participant> Participants { get; set; } = new();
    public string Mode { get; set; } = "board"; // board, screen, image
    public List<CollaborationMessage> ChatMessages { get; set; } = new();
}

public class Participant
{
    public string ConnectionId { get; set; } = string.Empty;
    public string PeerId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Color { get; set; } = "#007AFF";
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    public bool IsHost { get; set; } = false;
}
