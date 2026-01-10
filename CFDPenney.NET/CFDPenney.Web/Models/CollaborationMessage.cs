namespace CFDPenney.Web.Models;

public class CollaborationMessage
{
    public string Type { get; set; } = string.Empty; // chat, cursor, state, etc.
    public string? Content { get; set; }
    public string PeerId { get; set; } = string.Empty;
    public string? Name { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public Dictionary<string, object>? Data { get; set; }
}
