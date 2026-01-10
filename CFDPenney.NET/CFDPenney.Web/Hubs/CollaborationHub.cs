using Microsoft.AspNetCore.SignalR;
using CFDPenney.Web.Models;
using CFDPenney.Web.Services;

namespace CFDPenney.Web.Hubs;

public class CollaborationHub : Hub
{
    private readonly ISessionService _sessionService;
    private readonly ILogger<CollaborationHub> _logger;

    public CollaborationHub(ISessionService sessionService, ILogger<CollaborationHub> logger)
    {
        _sessionService = sessionService;
        _logger = logger;
    }

    public async Task<string> HostSession(string mode = "board")
    {
        var session = _sessionService.CreateSession(Context.ConnectionId, mode);
        await Groups.AddToGroupAsync(Context.ConnectionId, session.Code);
        
        _logger.LogInformation("Session created: {Code} by {ConnectionId}", session.Code, Context.ConnectionId);
        
        return session.Code;
    }

    public async Task<bool> JoinSession(string code, string peerId, string name = "Guest")
    {
        var session = _sessionService.GetSession(code);
        if (session == null)
        {
            _logger.LogWarning("Attempt to join non-existent session: {Code}", code);
            return false;
        }

        var joined = _sessionService.JoinSession(code, Context.ConnectionId, peerId, name);
        if (!joined)
        {
            return false;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, code);
        _sessionService.UpdateSessionActivity(code);

        // Notify other participants
        var participant = _sessionService.GetParticipantByConnectionId(Context.ConnectionId);
        if (participant != null)
        {
            await Clients.Group(code).SendAsync("ParticipantJoined", new
            {
                ConnectionId = Context.ConnectionId,
                PeerId = peerId,
                Name = name,
                Color = participant.Color
            });
        }

        // Send current participants to the new joiner
        var participants = session.Participants.Select(p => new
        {
            p.ConnectionId,
            p.PeerId,
            p.Name,
            p.Color,
            p.IsHost
        }).ToList();

        // Send chat history to the new joiner
        var chatHistory = session.ChatMessages.Select(m => new
        {
            m.Type,
            m.Content,
            m.PeerId,
            m.Name,
            m.Timestamp,
            m.Data
        }).ToList();

        await Clients.Caller.SendAsync("SessionJoined", new
        {
            Code = code,
            Participants = participants,
            Mode = session.Mode,
            ChatHistory = chatHistory
        });

        _logger.LogInformation("User {ConnectionId} joined session {Code}", Context.ConnectionId, code);
        return true;
    }

    public async Task SendDrawingAction(string code, DrawingAction action)
    {
        _sessionService.UpdateSessionActivity(code);
        action.PeerId = _sessionService.GetParticipantByConnectionId(Context.ConnectionId)?.PeerId ?? Context.ConnectionId;
        action.Timestamp = DateTime.UtcNow;

        await Clients.GroupExcept(code, Context.ConnectionId).SendAsync("DrawingAction", action);
    }

    public async Task SendChatMessage(string code, string message, string? name = null)
    {
        _sessionService.UpdateSessionActivity(code);
        var participant = _sessionService.GetParticipantByConnectionId(Context.ConnectionId);
        var session = _sessionService.GetSession(code);
        
        if (session == null) return;
        
        var chatMessage = new CollaborationMessage
        {
            Type = "chat",
            Content = message,
            PeerId = participant?.PeerId ?? Context.ConnectionId,
            Name = name ?? participant?.Name ?? "Guest",
            Timestamp = DateTime.UtcNow
        };

        // Store message in session (server-side in-memory)
        lock (session.ChatMessages)
        {
            session.ChatMessages.Add(chatMessage);
            // Limit to last 500 messages
            if (session.ChatMessages.Count > 500)
            {
                session.ChatMessages.RemoveAt(0);
            }
        }

        // Broadcast to all participants
        await Clients.Group(code).SendAsync("ChatMessage", chatMessage);
    }

    public async Task UpdateCursorPosition(string code, double x, double y)
    {
        var participant = _sessionService.GetParticipantByConnectionId(Context.ConnectionId);
        if (participant == null) return;

        await Clients.GroupExcept(code, Context.ConnectionId).SendAsync("CursorUpdate", new
        {
            PeerId = participant.PeerId,
            X = x,
            Y = y,
            Color = participant.Color
        });
    }

    public async Task SendStateUpdate(string code, Dictionary<string, object> state)
    {
        _sessionService.UpdateSessionActivity(code);
        await Clients.GroupExcept(code, Context.ConnectionId).SendAsync("StateUpdate", state);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var sessionCode = _sessionService.GetSessionCodeByConnectionId(Context.ConnectionId);
        if (!string.IsNullOrEmpty(sessionCode))
        {
            var participant = _sessionService.GetParticipantByConnectionId(Context.ConnectionId);
            _sessionService.LeaveSession(Context.ConnectionId);

            if (participant != null)
            {
                await Clients.Group(sessionCode).SendAsync("ParticipantLeft", new
                {
                    ConnectionId = Context.ConnectionId,
                    PeerId = participant.PeerId
                });
            }

            await Groups.RemoveFromGroupAsync(Context.ConnectionId, sessionCode);
            _logger.LogInformation("User {ConnectionId} left session {Code}", Context.ConnectionId, sessionCode);
        }

        await base.OnDisconnectedAsync(exception);
    }
}
