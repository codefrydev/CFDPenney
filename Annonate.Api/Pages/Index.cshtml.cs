using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Annonate.Api.Data;
using Annonate.Api.DTOs;

namespace Annonate.Api.Pages;

[Authorize]
public class IndexModel : PageModel
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<IndexModel> _logger;

    public IndexModel(ApplicationDbContext context, ILogger<IndexModel> logger)
    {
        _context = context;
        _logger = logger;
    }

    public Guid CurrentUserId { get; set; }
    public UserDto? CurrentUser { get; set; }

    public async Task<IActionResult> OnGetAsync()
    {
        var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return RedirectToPage("/Login");
        }

        CurrentUserId = userId;

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user != null)
        {
            CurrentUser = new UserDto
            {
                Id = user.Id,
                Name = user.Name,
                Email = user.Email,
                Avatar = user.Avatar
            };
        }

        return Page();
    }
}
