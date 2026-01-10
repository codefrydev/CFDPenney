namespace CFDPenney.Web.Models;

public class DrawingAction
{
    public string Type { get; set; } = string.Empty; // draw, erase, clear, shape, text, etc.
    public string Tool { get; set; } = string.Empty;
    public double X { get; set; }
    public double Y { get; set; }
    public double? EndX { get; set; }
    public double? EndY { get; set; }
    public string Color { get; set; } = "#000000";
    public string? FillColor { get; set; }
    public double StrokeWidth { get; set; } = 2;
    public bool IsDrawing { get; set; } = false;
    public string? Text { get; set; }
    public Dictionary<string, object>? Properties { get; set; }
    public string PeerId { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
