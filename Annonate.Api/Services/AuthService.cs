using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using Annonate.Api.Data;
using Annonate.Api.DTOs;
using Annonate.Api.Models;

namespace Annonate.Api.Services;

public class AuthService : IAuthService
{
    private readonly ApplicationDbContext _context;

    public AuthService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request, HttpContext httpContext)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
        if (user == null || string.IsNullOrEmpty(user.PasswordHash) || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            throw new UnauthorizedAccessException("Invalid email or password");
        }

        user.LastSeen = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        // Create claims for the user
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Name ?? ""),
            new Claim(ClaimTypes.Email, user.Email ?? "")
        };

        var claimsIdentity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        var authProperties = new AuthenticationProperties
        {
            IsPersistent = true,
            ExpiresUtc = DateTimeOffset.UtcNow.AddDays(7)
        };

        // Sign in and set cookie
        await httpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(claimsIdentity),
            authProperties);

        return new LoginResponse
        {
            Token = string.Empty, // No token needed - using cookies
            RefreshToken = string.Empty,
            User = new UserDto
            {
                Id = user.Id,
                Name = user.Name ?? "",
                Email = user.Email ?? "",
                Avatar = user.Avatar
            }
        };
    }

    public async Task<LoginResponse> RegisterAsync(RegisterRequest request, HttpContext httpContext)
    {
        if (await _context.Users.AnyAsync(u => u.Email == request.Email))
        {
            throw new InvalidOperationException("Email already exists");
        }

        var user = new User
        {
            Name = request.Name,
            Email = request.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Avatar = $"https://api.dicebear.com/7.x/avataaars/svg?seed={request.Name}",
            Status = "available"
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        // Create claims for the new user
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Name ?? ""),
            new Claim(ClaimTypes.Email, user.Email ?? "")
        };

        var claimsIdentity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        var authProperties = new AuthenticationProperties
        {
            IsPersistent = true,
            ExpiresUtc = DateTimeOffset.UtcNow.AddDays(7)
        };

        // Sign in and set cookie
        await httpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(claimsIdentity),
            authProperties);

        return new LoginResponse
        {
            Token = string.Empty, // No token needed - using cookies
            RefreshToken = string.Empty,
            User = new UserDto
            {
                Id = user.Id,
                Name = user.Name ?? "",
                Email = user.Email ?? "",
                Avatar = user.Avatar
            }
        };
    }
}
