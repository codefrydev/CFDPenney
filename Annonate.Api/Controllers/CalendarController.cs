using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Annonate.Api.Data;
using Annonate.Api.DTOs;
using Annonate.Api.Models;

namespace Annonate.Api.Controllers;

// [Authorize] - TEMPORARILY DISABLED
[ApiController]
[Route("api/[controller]")]
public class CalendarController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public CalendarController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("events")]
    public async Task<ActionResult<ApiResponse<List<object>>>> GetEvents([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
    {
        // TEMPORARY: Use default userId when auth is disabled
        var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier);
        var userId = userIdClaim != null ? Guid.Parse(userIdClaim.Value) : Guid.Parse("00000000-0000-0000-0000-000000000001");

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

        return Ok(ApiResponse<List<object>>.SuccessResponse(events.Cast<object>().ToList()));
    }

    [HttpPost("events")]
    public async Task<ActionResult<ApiResponse<object>>> CreateEvent([FromBody] CreateEventRequest request)
    {
        // TEMPORARY: Use default userId when auth is disabled
        var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier);
        var userId = userIdClaim != null ? Guid.Parse(userIdClaim.Value) : Guid.Parse("00000000-0000-0000-0000-000000000001");

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

        return Ok(ApiResponse<object>.SuccessResponse(response));
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
