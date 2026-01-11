using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using Annonate.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Annonate.Api.Hubs;

public class ChatHub : Hub
{
    private static readonly Dictionary<Guid, HashSet<string>> _userConnections = new();
    private static readonly object _lock = new();
    private readonly ApplicationDbContext _context;

    public ChatHub(ApplicationDbContext context)
    {
        _context = context;
    }

    public static HashSet<Guid> GetOnlineUserIds()
    {
        lock (_lock)
        {
            return new HashSet<Guid>(_userConnections.Keys);
        }
    }

    public override async Task OnConnectedAsync()
    {
        // Check authentication when connection is established
        var userId = GetUserId();
        if (userId == null)
        {
            Context.Abort();
            return;
        }

        bool isNewUser = false;
        lock (_lock)
        {
            if (!_userConnections.ContainsKey(userId.Value))
            {
                _userConnections[userId.Value] = new HashSet<string>();
                isNewUser = true;
            }
            _userConnections[userId.Value].Add(Context.ConnectionId);
        }

        await base.OnConnectedAsync();

        // Broadcast user online status if this is their first connection
        if (isNewUser)
        {
            await Clients.AllExcept(Context.ConnectionId).SendAsync("UserOnline", new
            {
                userId = userId.Value
            });
        }
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = GetUserId();
        if (userId != null)
        {
            bool isLastConnection = false;
            lock (_lock)
            {
                if (_userConnections.ContainsKey(userId.Value))
                {
                    _userConnections[userId.Value].Remove(Context.ConnectionId);
                    if (_userConnections[userId.Value].Count == 0)
                    {
                        _userConnections.Remove(userId.Value);
                        isLastConnection = true;
                    }
                }
            }

            // Update LastSeen in database if this was the last connection
            if (isLastConnection)
            {
                var user = await _context.Users.FindAsync(userId.Value);
                if (user != null)
                {
                    user.LastSeen = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                }

                // Broadcast user offline status
                await Clients.AllExcept(Context.ConnectionId).SendAsync("UserOffline", new
                {
                    userId = userId.Value
                });
            }
        }

        await base.OnDisconnectedAsync(exception);
    }
    public async Task SendMessage(Guid chatId, string text)
    {
        var userId = GetUserId();
        if (userId == null) return;

        await Clients.Group($"chat-{chatId}").SendAsync("ReceiveMessage", new
        {
            id = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            chatId,
            senderId = userId,
            text,
            time = DateTime.UtcNow.ToString("hh:mm tt"),
            type = "text"
        });
    }

    public async Task JoinChat(Guid chatId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"chat-{chatId}");
    }

    public async Task LeaveChat(Guid chatId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"chat-{chatId}");
    }

    public async Task SendTypingIndicator(Guid chatId)
    {
        var userId = GetUserId();
        if (userId == null) return;

        await Clients.GroupExcept($"chat-{chatId}", Context.ConnectionId)
            .SendAsync("UserTyping", new
            {
                chatId,
                userId,
                userName = Context.User?.Identity?.Name ?? "User"
            });
    }

    public async Task GetOnlineUsers()
    {
        var onlineUserIds = GetOnlineUserIds();
        await Clients.Caller.SendAsync("OnlineUsers", onlineUserIds.ToList());
    }

    // Call Signaling Methods
    public async Task InitiateCall(Guid targetUserId, string callType)
    {
        var callerId = GetUserId();
        if (callerId == null) return;

        // Create call record in database
        var call = new Models.Call
        {
            InitiatorId = callerId.Value,
            Type = callType,
            Status = "ringing",
            StartedAt = DateTime.UtcNow
        };
        _context.Calls.Add(call);
        await _context.SaveChangesAsync();

        // Add participants
        _context.CallParticipants.Add(new Models.CallParticipant
        {
            CallId = call.Id,
            UserId = callerId.Value,
            JoinedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();

        // Send call invitation to target user
        await Clients.User(targetUserId.ToString()).SendAsync("IncomingCall", new
        {
            callId = call.Id,
            callerId = callerId.Value,
            callType = callType
        });

        // Notify caller that call was initiated
        await Clients.Caller.SendAsync("CallInitiated", new
        {
            callId = call.Id,
            targetUserId = targetUserId
        });
    }

    public async Task AcceptCall(Guid callId, Guid callerId)
    {
        var userId = GetUserId();
        if (userId == null) return;

        var call = await _context.Calls.FindAsync(callId);
        if (call == null || call.InitiatorId != callerId) return;

        // Add participant
        _context.CallParticipants.Add(new Models.CallParticipant
        {
            CallId = callId,
            UserId = userId.Value,
            JoinedAt = DateTime.UtcNow
        });
        call.Status = "active";
        await _context.SaveChangesAsync();

        // Notify caller that call was accepted
        await Clients.User(callerId.ToString()).SendAsync("CallAccepted", new
        {
            callId = callId,
            calleeId = userId.Value
        });
    }

    public async Task RejectCall(Guid callId, Guid callerId)
    {
        var userId = GetUserId();
        if (userId == null) return;

        var call = await _context.Calls.FindAsync(callId);
        if (call != null)
        {
            call.Status = "missed";
            call.EndedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        // Notify caller that call was rejected
        await Clients.User(callerId.ToString()).SendAsync("CallRejected", new
        {
            callId = callId,
            calleeId = userId.Value
        });
    }

    public async Task EndCall(Guid callId)
    {
        var userId = GetUserId();
        if (userId == null) return;

        var call = await _context.Calls
            .Include(c => c.Participants)
            .FirstOrDefaultAsync(c => c.Id == callId);

        if (call == null) return;

        // Update call status and duration
        call.Status = "completed";
        call.EndedAt = DateTime.UtcNow;
        if (call.EndedAt.HasValue)
        {
            call.Duration = (int)(call.EndedAt.Value - call.StartedAt).TotalSeconds;
        }

        // Update participant left time
        var participant = call.Participants.FirstOrDefault(p => p.UserId == userId.Value);
        if (participant != null)
        {
            participant.LeftAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        // Notify all participants
        var participantIds = call.Participants.Select(p => p.UserId).ToList();
        foreach (var participantId in participantIds)
        {
            if (participantId != userId.Value)
            {
                await Clients.User(participantId.ToString()).SendAsync("CallEnded", new
                {
                    callId = callId,
                    endedBy = userId.Value
                });
            }
        }
    }

    public async Task SendWebRTCSignal(Guid targetUserId, object signal)
    {
        var userId = GetUserId();
        if (userId == null) return;

        // Forward WebRTC signaling (ICE candidates, offers, answers) to target user
        await Clients.User(targetUserId.ToString()).SendAsync("WebRTCSignal", new
        {
            fromUserId = userId.Value,
            signal = signal
        });
    }

    private Guid? GetUserId()
    {
        // Try to get from claims first (when auth is enabled)
        var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim != null && Guid.TryParse(userIdClaim, out var userId))
        {
            return userId;
        }

        // TEMPORARY: Get from query string when auth is disabled
        var httpContext = Context.GetHttpContext();
        if (httpContext != null)
        {
            var queryUserId = httpContext.Request.Query["userId"].FirstOrDefault();
            if (queryUserId != null && Guid.TryParse(queryUserId, out var queryId))
            {
                return queryId;
            }
        }

        // Fallback to default user ID (temporary workaround)
        return Guid.Parse("00000000-0000-0000-0000-000000000001");
    }
}
