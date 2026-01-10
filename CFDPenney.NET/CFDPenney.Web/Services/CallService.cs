using CFDPenney.Web.Models;
using System.Collections.Concurrent;

namespace CFDPenney.Web.Services;

public interface ICallService
{
    Call StartCall(string conversationId, string callerId, CallType type);
    Call? GetCall(string callId);
    Call? GetActiveCall(string conversationId);
    bool EndCall(string callId);
    bool AddParticipant(string callId, string userId);
    bool RemoveParticipant(string callId, string userId);
    List<Call> GetActiveCalls();
}

public class CallService : ICallService
{
    private readonly ConcurrentDictionary<string, Call> _calls = new();
    private readonly ConcurrentDictionary<string, string> _conversationCalls = new(); // conversationId -> callId

    public Call StartCall(string conversationId, string callerId, CallType type)
    {
        var callId = Guid.NewGuid().ToString();
        var call = new Call
        {
            Id = callId,
            ConversationId = conversationId,
            CallerId = callerId,
            Type = type,
            Status = CallStatus.Ringing,
            StartedAt = DateTime.UtcNow,
            Participants = new List<CallParticipant>
            {
                new CallParticipant
                {
                    UserId = callerId,
                    JoinedAt = DateTime.UtcNow,
                    IsMuted = false,
                    IsVideoEnabled = type == CallType.Video
                }
            }
        };

        _calls[callId] = call;
        _conversationCalls[conversationId] = callId;
        return call;
    }

    public Call? GetCall(string callId)
    {
        _calls.TryGetValue(callId, out var call);
        return call;
    }

    public Call? GetActiveCall(string conversationId)
    {
        if (!_conversationCalls.TryGetValue(conversationId, out var callId))
            return null;

        return GetCall(callId);
    }

    public bool EndCall(string callId)
    {
        if (!_calls.TryGetValue(callId, out var call))
            return false;

        call.Status = CallStatus.Ended;
        call.EndedAt = DateTime.UtcNow;
        
        _conversationCalls.TryRemove(call.ConversationId, out _);
        _calls.TryRemove(callId, out _);
        return true;
    }

    public bool AddParticipant(string callId, string userId)
    {
        if (!_calls.TryGetValue(callId, out var call))
            return false;

        if (call.Participants.Any(p => p.UserId == userId))
            return true; // Already in call

        call.Participants.Add(new CallParticipant
        {
            UserId = userId,
            JoinedAt = DateTime.UtcNow,
            IsMuted = false,
            IsVideoEnabled = call.Type == CallType.Video
        });

        if (call.Status == CallStatus.Ringing)
        {
            call.Status = CallStatus.Active;
        }

        return true;
    }

    public bool RemoveParticipant(string callId, string userId)
    {
        if (!_calls.TryGetValue(callId, out var call))
            return false;

        var participant = call.Participants.FirstOrDefault(p => p.UserId == userId);
        if (participant == null)
            return false;

        call.Participants.Remove(participant);

        // If no participants left, end the call
        if (call.Participants.Count == 0)
        {
            EndCall(callId);
        }

        return true;
    }

    public List<Call> GetActiveCalls()
    {
        return _calls.Values
            .Where(c => c.Status == CallStatus.Active || c.Status == CallStatus.Ringing)
            .ToList();
    }
}

public class Call
{
    public string Id { get; set; } = string.Empty;
    public string ConversationId { get; set; } = string.Empty;
    public string CallerId { get; set; } = string.Empty;
    public CallType Type { get; set; }
    public CallStatus Status { get; set; }
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? EndedAt { get; set; }
    public List<CallParticipant> Participants { get; set; } = new();
}

public class CallParticipant
{
    public string UserId { get; set; } = string.Empty;
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    public bool IsMuted { get; set; }
    public bool IsVideoEnabled { get; set; }
}

public enum CallType
{
    Audio = 1,
    Video = 2
}

public enum CallStatus
{
    Ringing = 1,
    Active = 2,
    Ended = 3
}
