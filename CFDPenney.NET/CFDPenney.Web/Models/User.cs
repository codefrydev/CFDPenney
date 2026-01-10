namespace CFDPenney.Web.Models;

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string? Avatar { get; set; } // URL or base64 image
    public string? Status { get; set; } // Custom status message
}
