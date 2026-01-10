using CFDPenney.Web.Models;
using System.Security.Cryptography;
using System.Text;

namespace CFDPenney.Web.Services;

public interface IUserService
{
    User? ValidateUser(string username, string password);
    User? GetUserByUsername(string username);
}

public class UserService : IUserService
{
    private readonly List<User> _users;

    public UserService()
    {
        // Initialize with 2-3 test users
        _users = new List<User>
        {
            new User
            {
                Id = 1,
                Username = "testuser1",
                Password = HashPassword("password1"),
                Email = "testuser1@example.com"
            },
            new User
            {
                Id = 2,
                Username = "testuser2",
                Password = HashPassword("password2"),
                Email = "testuser2@example.com"
            },
            new User
            {
                Id = 3,
                Username = "admin",
                Password = HashPassword("admin123"),
                Email = "admin@example.com"
            }
        };
    }

    public User? ValidateUser(string username, string password)
    {
        var user = GetUserByUsername(username);
        if (user == null)
            return null;

        var hashedPassword = HashPassword(password);
        return user.Password == hashedPassword ? user : null;
    }

    public User? GetUserByUsername(string username)
    {
        return _users.FirstOrDefault(u => u.Username.Equals(username, StringComparison.OrdinalIgnoreCase));
    }

    private static string HashPassword(string password)
    {
        // Simple hash for testing purposes
        // In production, use proper password hashing like BCrypt or PBKDF2
        using var sha256 = SHA256.Create();
        var bytes = Encoding.UTF8.GetBytes(password);
        var hash = sha256.ComputeHash(bytes);
        return Convert.ToBase64String(hash);
    }
}
