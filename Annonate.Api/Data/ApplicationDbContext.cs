using Microsoft.EntityFrameworkCore;
using Annonate.Api.Models;

namespace Annonate.Api.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users { get; set; }
    public DbSet<Chat> Chats { get; set; }
    public DbSet<ChatMember> ChatMembers { get; set; }
    public DbSet<Message> Messages { get; set; }
    public DbSet<MessageReaction> MessageReactions { get; set; }
    public DbSet<Team> Teams { get; set; }
    public DbSet<TeamMember> TeamMembers { get; set; }
    public DbSet<Channel> Channels { get; set; }
    public DbSet<Post> Posts { get; set; }
    public DbSet<PostReply> PostReplies { get; set; }
    public DbSet<CalendarEvent> CalendarEvents { get; set; }
    public DbSet<CalendarEventAttendee> CalendarEventAttendees { get; set; }
    public DbSet<Call> Calls { get; set; }
    public DbSet<CallParticipant> CallParticipants { get; set; }
    public DbSet<UploadedFile> Files { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // User configuration
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        // Chat configuration
        modelBuilder.Entity<ChatMember>()
            .HasIndex(cm => new { cm.ChatId, cm.UserId })
            .IsUnique();

        // Team configuration
        modelBuilder.Entity<TeamMember>()
            .HasIndex(tm => new { tm.TeamId, tm.UserId })
            .IsUnique();

        // Message reactions
        modelBuilder.Entity<MessageReaction>()
            .HasIndex(mr => new { mr.MessageId, mr.UserId, mr.Emoji })
            .IsUnique();

        // Calendar event attendees
        modelBuilder.Entity<CalendarEventAttendee>()
            .HasIndex(cea => new { cea.EventId, cea.UserId })
            .IsUnique();

        // CalendarEvent foreign key configuration
        modelBuilder.Entity<CalendarEvent>()
            .HasOne(e => e.Creator)
            .WithMany(u => u.CalendarEvents)
            .HasForeignKey(e => e.CreatedBy)
            .OnDelete(DeleteBehavior.Restrict);

        // CalendarEventAttendee foreign key configuration
        modelBuilder.Entity<CalendarEventAttendee>()
            .HasOne(ea => ea.Event)
            .WithMany(e => e.Attendees)
            .HasForeignKey(ea => ea.EventId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<CalendarEventAttendee>()
            .HasOne(ea => ea.User)
            .WithMany()
            .HasForeignKey(ea => ea.UserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
