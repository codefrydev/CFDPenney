using Annonate.Api.DTOs;
using System.Security.Claims;

namespace Annonate.Api.Services;

public interface IAuthService
{
    Task<LoginResponse> LoginAsync(LoginRequest request, HttpContext httpContext);
    Task<LoginResponse> RegisterAsync(RegisterRequest request, HttpContext httpContext);
}
