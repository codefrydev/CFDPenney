using CFDPenney.Web.Models;
using System.Collections.Concurrent;

namespace CFDPenney.Web.Services;

public interface ISessionService
{
    Session CreateSession(string hostConnectionId, string mode = "board");
    Session? GetSession(string code);
    bool JoinSession(string code, string connectionId, string peerId, string name);
    void LeaveSession(string connectionId);
    void UpdateSessionActivity(string code);
    void CleanupExpiredSessions(TimeSpan timeout);
    List<Session> GetActiveSessions();
    Participant? GetParticipantByConnectionId(string connectionId);
    string? GetSessionCodeByConnectionId(string connectionId);
}

public class SessionService : ISessionService
{
    private readonly ConcurrentDictionary<string, Session> _sessions = new();
    private readonly ConcurrentDictionary<string, string> _connectionToSession = new(); // connectionId -> sessionCode
    private readonly object _lock = new();
    private static readonly string SessionCodeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    public Session CreateSession(string hostConnectionId, string mode = "board")
    {
        string code;
        do
        {
            code = GenerateSessionCode();
        } while (_sessions.ContainsKey(code));

        var session = new Session
        {
            Code = code,
            HostId = hostConnectionId,
            Mode = mode,
            CreatedAt = DateTime.UtcNow,
            LastActivity = DateTime.UtcNow,
            Participants = new List<Participant>
            {
                new Participant
                {
                    ConnectionId = hostConnectionId,
                    PeerId = code, // Host's peer ID is the session code
                    Name = "Host",
                    Color = GetRandomColor(),
                    IsHost = true,
                    JoinedAt = DateTime.UtcNow
                }
            }
        };

        _sessions[code] = session;
        _connectionToSession[hostConnectionId] = code;

        return session;
    }

    public Session? GetSession(string code)
    {
        _sessions.TryGetValue(code, out var session);
        return session;
    }

    public bool JoinSession(string code, string connectionId, string peerId, string name)
    {
        if (!_sessions.TryGetValue(code, out var session))
            return false;

        lock (_lock)
        {
            // Check if already in session
            if (session.Participants.Any(p => p.ConnectionId == connectionId))
                return true;

            var participant = new Participant
            {
                ConnectionId = connectionId,
                PeerId = peerId,
                Name = name,
                Color = GetRandomColor(),
                IsHost = false,
                JoinedAt = DateTime.UtcNow
            };

            session.Participants.Add(participant);
            _connectionToSession[connectionId] = code;
            session.LastActivity = DateTime.UtcNow;
        }

        return true;
    }

    public void LeaveSession(string connectionId)
    {
        if (!_connectionToSession.TryRemove(connectionId, out var sessionCode))
            return;

        if (!_sessions.TryGetValue(sessionCode, out var session))
            return;

        lock (_lock)
        {
            var participant = session.Participants.FirstOrDefault(p => p.ConnectionId == connectionId);
            if (participant != null)
            {
                session.Participants.Remove(participant);
                session.LastActivity = DateTime.UtcNow;
            }

            // If no participants left, remove session
            if (session.Participants.Count == 0)
            {
                _sessions.TryRemove(sessionCode, out _);
            }
        }
    }

    public void UpdateSessionActivity(string code)
    {
        if (_sessions.TryGetValue(code, out var session))
        {
            session.LastActivity = DateTime.UtcNow;
        }
    }

    public void CleanupExpiredSessions(TimeSpan timeout)
    {
        var expiredSessions = _sessions.Values
            .Where(s => DateTime.UtcNow - s.LastActivity > timeout)
            .Select(s => s.Code)
            .ToList();

        foreach (var code in expiredSessions)
        {
            if (_sessions.TryRemove(code, out var session))
            {
                foreach (var participant in session.Participants)
                {
                    _connectionToSession.TryRemove(participant.ConnectionId, out _);
                }
            }
        }
    }

    public List<Session> GetActiveSessions()
    {
        return _sessions.Values.ToList();
    }

    public Participant? GetParticipantByConnectionId(string connectionId)
    {
        if (!_connectionToSession.TryGetValue(connectionId, out var sessionCode))
            return null;

        if (!_sessions.TryGetValue(sessionCode, out var session))
            return null;

        return session.Participants.FirstOrDefault(p => p.ConnectionId == connectionId);
    }

    public string? GetSessionCodeByConnectionId(string connectionId)
    {
        _connectionToSession.TryGetValue(connectionId, out var sessionCode);
        return sessionCode;
    }

    private string GenerateSessionCode()
    {
        var random = new Random();
        var code = new char[5];
        for (int i = 0; i < 5; i++)
        {
            code[i] = SessionCodeChars[random.Next(SessionCodeChars.Length)];
        }
        return new string(code);
    }

    private string GetRandomColor()
    {
        var colors = new[] { "#FF3B30", "#FF9500", "#FFCC00", "#4CD964", "#5AC8FA", "#007AFF", "#5856D6" };
        return colors[new Random().Next(colors.Length)];
    }
}
