using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Annonate.Api.DTOs;
using Annonate.Api.Services;

namespace Annonate.Api.Pages;

[IgnoreAntiforgeryToken]
public class RegisterModel : PageModel
{
    private readonly IAuthService _authService;
    private readonly ILogger<RegisterModel> _logger;

    public RegisterModel(IAuthService authService, ILogger<RegisterModel> logger)
    {
        _authService = authService;
        _logger = logger;
    }

    public string? ErrorMessage { get; set; }

    public void OnGet()
    {
        // If already authenticated, redirect to Index
        if (User.Identity?.IsAuthenticated == true)
        {
            Response.Redirect("/Index");
        }
    }

    public async Task<IActionResult> OnPostRegisterAsync([FromBody] RegisterRequest request)
    {
        if (request == null || string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Password) || string.IsNullOrEmpty(request.Name))
        {
            return new JsonResult(new { success = false, message = "Name, email and password are required" });
        }

        try
        {
            var response = await _authService.RegisterAsync(request, HttpContext);
            return new JsonResult(new { success = true, user = response.User });
        }
        catch (InvalidOperationException ex)
        {
            return new JsonResult(new { success = false, message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during registration");
            return new JsonResult(new { success = false, message = "An error occurred during registration" });
        }
    }
}
