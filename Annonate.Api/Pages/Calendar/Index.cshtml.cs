using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Annonate.Api.Data;
using Annonate.Api.DTOs;
using Annonate.Api.Models;

namespace Annonate.Api.Pages.Calendar;

[Authorize]
[IgnoreAntiforgeryToken]
public class IndexModel : PageModel
{
    private readonly ApplicationDbContext _context;

    public IndexModel(ApplicationDbContext context)
    {
        _context = context;
    }

    public IActionResult OnGet()
    {
        return NotFound();
    }

    private Guid GetUserId()
    {
        var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return userId;
        }
        return Guid.Parse("00000000-0000-0000-0000-000000000001");
    }

    public async Task<IActionResult> OnGetEventsAsync([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
    {
        var userId = GetUserId();

        var query = _context.CalendarEvents
            .Where(e => e.CreatedBy == userId || e.Attendees.Any(a => a.UserId == userId));

        if (startDate.HasValue)
        {
            query = query.Where(e => e.Start >= startDate.Value);
        }
        if (endDate.HasValue)
        {
            query = query.Where(e => e.End <= endDate.Value);
        }

        var events = await query
            .Select(e => new
            {
                id = e.Id,
                title = e.Title,
                start = e.Start.ToString("HH:mm"),
                end = e.End.ToString("HH:mm"),
                color = e.Color,
                col = e.Start.DayOfWeek == DayOfWeek.Monday ? 1 :
                      e.Start.DayOfWeek == DayOfWeek.Tuesday ? 2 :
                      e.Start.DayOfWeek == DayOfWeek.Wednesday ? 3 :
                      e.Start.DayOfWeek == DayOfWeek.Thursday ? 4 :
                      e.Start.DayOfWeek == DayOfWeek.Friday ? 5 : 1
            })
            .ToListAsync();

        return new JsonResult(ApiResponse<List<object>>.SuccessResponse(events.Cast<object>().ToList()));
    }

    public async Task<IActionResult> OnPostCreateEventAsync([FromBody] CreateEventRequest request)
    {
        var userId = GetUserId();

        var eventEntity = new CalendarEvent
        {
            Title = request.Title,
            Description = request.Description ?? "",
            Start = request.Start,
            End = request.End,
            Color = request.Color ?? "#5b5fc7",
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow
        };

        _context.CalendarEvents.Add(eventEntity);
        await _context.SaveChangesAsync();

        var response = new
        {
            id = eventEntity.Id,
            title = eventEntity.Title,
            start = eventEntity.Start.ToString("HH:mm"),
            end = eventEntity.End.ToString("HH:mm"),
            color = eventEntity.Color
        };

        return new JsonResult(ApiResponse<object>.SuccessResponse(response));
    }
}

public class CreateEventRequest
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime Start { get; set; }
    public DateTime End { get; set; }
    public string? Color { get; set; }
}
