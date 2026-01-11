using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;
using Annonate.Api.DTOs;
using Annonate.Api.Services;

namespace Annonate.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("login")]
    public async Task<ActionResult<ApiResponse<LoginResponse>>> Login([FromBody] LoginRequest request)
    {
        try
        {
            if (request == null)
            {
                return BadRequest(ApiResponse<LoginResponse>.ErrorResponse("Request body is required"));
            }

            if (string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Password))
            {
                return BadRequest(ApiResponse<LoginResponse>.ErrorResponse("Email and password are required"));
            }

            var response = await _authService.LoginAsync(request, HttpContext);
            return Ok(ApiResponse<LoginResponse>.SuccessResponse(response));
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(ApiResponse<LoginResponse>.ErrorResponse(ex.Message));
        }
        catch (Exception ex)
        {
            return StatusCode(500, ApiResponse<LoginResponse>.ErrorResponse($"An error occurred: {ex.Message}"));
        }
    }

    [HttpPost("register")]
    public async Task<ActionResult<ApiResponse<LoginResponse>>> Register([FromBody] RegisterRequest request)
    {
        try
        {
            var response = await _authService.RegisterAsync(request, HttpContext);
            return Ok(ApiResponse<LoginResponse>.SuccessResponse(response));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<LoginResponse>.ErrorResponse(ex.Message));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<LoginResponse>.ErrorResponse(ex.Message));
        }
    }

    [HttpPost("logout")]
    public async Task<ActionResult<ApiResponse<object>>> Logout()
    {
        await HttpContext.SignOutAsync("Cookies");
        return Ok(ApiResponse<object>.SuccessResponse(new { message = "Logged out successfully" }));
    }
}
