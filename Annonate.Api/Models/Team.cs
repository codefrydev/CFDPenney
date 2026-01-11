namespace Annonate.Api.Models;

public class Team
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Icon { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ICollection<TeamMember> Members { get; set; } = new List<TeamMember>();
    public ICollection<Channel> Channels { get; set; } = new List<Channel>();
}

public class TeamMember
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string TeamId { get; set; } = string.Empty;
    public Guid UserId { get; set; }
    public string Role { get; set; } = "member"; // owner, admin, member

    // Navigation properties
    public Team Team { get; set; } = null!;
    public User User { get; set; } = null!;
}

public class Channel
{
    public string Id { get; set; } = string.Empty;
    public string TeamId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Team Team { get; set; } = null!;
    public ICollection<Post> Posts { get; set; } = new List<Post>();
}

public class Post
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string ChannelId { get; set; } = string.Empty;
    public Guid UserId { get; set; }
    public string Text { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Channel Channel { get; set; } = null!;
    public User User { get; set; } = null!;
    public ICollection<PostReply> Replies { get; set; } = new List<PostReply>();
}

public class PostReply
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PostId { get; set; }
    public Guid UserId { get; set; }
    public string Text { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Post Post { get; set; } = null!;
    public User User { get; set; } = null!;
}
