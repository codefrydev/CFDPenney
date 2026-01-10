using CFDPenney.Web.Models;
using System.Collections.Concurrent;

namespace CFDPenney.Web.Services;

public interface IPresenceService
{
    void SetOnline(string userId, string? statusMessage = null);
    void SetOffline(string userId);
    void SetStatus(string userId, PresenceStatus status, string? statusMessage = null);
    UserPresence? GetPresence(string userId);
    List<UserPresence> GetOnlineUsers();
    Dictionary<string, UserPresence> GetAllPresences();
}

public class PresenceService : IPresenceService
{
    private readonly ConcurrentDictionary<string, UserPresence> _presences = new();
    private readonly IUserService _userService;

    public PresenceService(IUserService userService)
    {
        _userService = userService;
        InitializeMockPresence();
    }

    private void InitializeMockPresence()
    {
        var allUsers = _userService.GetAllUsers();
        
        // Set initial presence for all users
        foreach (var user in allUsers)
        {
            var userId = user.Id.ToString();
            // Randomly set some users as online, some offline
            var random = new Random(user.Id);
            var isOnline = random.Next(0, 2) == 1; // 50% chance
            
            if (isOnline)
            {
                SetOnline(userId, null);
            }
            else
            {
                SetOffline(userId);
                // Set last seen to a random time in the past
                if (_presences.TryGetValue(userId, out var presence))
                {
                    presence.LastSeen = DateTime.UtcNow.AddMinutes(-random.Next(5, 1440)); // 5 minutes to 24 hours ago
                }
            }
        }
    }

    public void SetOnline(string userId, string? statusMessage = null)
    {
        var presence = _presences.GetOrAdd(userId, _ => new UserPresence
        {
            UserId = userId,
            Status = PresenceStatus.Online,
            LastSeen = DateTime.UtcNow
        });

        presence.Status = PresenceStatus.Online;
        presence.LastSeen = DateTime.UtcNow;
        if (statusMessage != null)
        {
            presence.StatusMessage = statusMessage;
        }
    }

    public void SetOffline(string userId)
    {
        if (_presences.TryGetValue(userId, out var presence))
        {
            presence.Status = PresenceStatus.Offline;
            presence.LastSeen = DateTime.UtcNow;
        }
        else
        {
            _presences[userId] = new UserPresence
            {
                UserId = userId,
                Status = PresenceStatus.Offline,
                LastSeen = DateTime.UtcNow
            };
        }
    }

    public void SetStatus(string userId, PresenceStatus status, string? statusMessage = null)
    {
        var presence = _presences.GetOrAdd(userId, _ => new UserPresence
        {
            UserId = userId,
            Status = status,
            LastSeen = DateTime.UtcNow
        });

        presence.Status = status;
        presence.LastSeen = DateTime.UtcNow;
        if (statusMessage != null)
        {
            presence.StatusMessage = statusMessage;
        }
    }

    public UserPresence? GetPresence(string userId)
    {
        _presences.TryGetValue(userId, out var presence);
        return presence;
    }

    public List<UserPresence> GetOnlineUsers()
    {
        return _presences.Values
            .Where(p => p.Status != PresenceStatus.Offline)
            .ToList();
    }

    public Dictionary<string, UserPresence> GetAllPresences()
    {
        return _presences.ToDictionary(kvp => kvp.Key, kvp => kvp.Value);
    }
}
