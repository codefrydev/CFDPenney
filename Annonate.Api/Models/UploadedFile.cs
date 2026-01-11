namespace Annonate.Api.Models;

public class UploadedFile
{
    public int Id { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string OriginalFileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long Size { get; set; }
    public string FilePath { get; set; } = string.Empty;
    public int UploadedBy { get; set; }
    public int? ChatId { get; set; }
    public int? MessageId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public User Uploader { get; set; } = null!;
    public Chat? Chat { get; set; }
    public Message? Message { get; set; }
}
