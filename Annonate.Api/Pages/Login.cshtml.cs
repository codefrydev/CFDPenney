using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Annonate.Api.DTOs;
using Annonate.Api.Services;

namespace Annonate.Api.Pages;

[IgnoreAntiforgeryToken]
public class LoginModel : PageModel
{
    private readonly IAuthService _authService;
    private readonly ILogger<LoginModel> _logger;

    public LoginModel(IAuthService authService, ILogger<LoginModel> logger)
    {
        _authService = authService;
        _logger = logger;
    }

    public string? ErrorMessage { get; set; }
    public string? DisplayEmail { get; set; }

    public void OnGet()
    {
        // If already authenticated, redirect to Index
        if (User.Identity?.IsAuthenticated == true)
        {
            Response.Redirect("/Index");
        }
    }

    public async Task<IActionResult> OnPostLoginAsync([FromBody] LoginRequest request)
    {
        if (request == null || string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Password))
        {
            return new JsonResult(new { success = false, message = "Email and password are required" });
        }

        try
        {
            var response = await _authService.LoginAsync(request, HttpContext);
            return new JsonResult(new { success = true, user = response.User });
        }
        catch (UnauthorizedAccessException ex)
        {
            return new JsonResult(new { success = false, message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during login");
            return new JsonResult(new { success = false, message = "An error occurred during login" });
        }
    }

    public async Task<IActionResult> OnGetLogoutAsync()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return RedirectToPage("/Login");
    }
}
