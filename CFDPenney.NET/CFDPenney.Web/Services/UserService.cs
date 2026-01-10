using CFDPenney.Web.Models;
using System.Security.Cryptography;
using System.Text;

namespace CFDPenney.Web.Services;

public interface IUserService
{
    User? ValidateUser(string username, string password);
    User? GetUserByUsername(string username);
    User? GetUserById(string userId);
    List<User> GetAllUsers();
}

public class UserService : IUserService
{
    private readonly List<User> _users;

    public UserService()
    {
        // Initialize with test users
        _users = new List<User>
        {
            new User
            {
                Id = 1,
                Username = "testuser1",
                Password = HashPassword("password1"),
                Email = "testuser1@example.com",
                DisplayName = "Alice Johnson",
                Status = "Available"
            },
            new User
            {
                Id = 2,
                Username = "testuser2",
                Password = HashPassword("password2"),
                Email = "testuser2@example.com",
                DisplayName = "Bob Smith",
                Status = "In a meeting"
            },
            new User
            {
                Id = 3,
                Username = "admin",
                Password = HashPassword("admin123"),
                Email = "admin@example.com",
                DisplayName = "Administrator",
                Status = "Available"
            },
            new User
            {
                Id = 4,
                Username = "developer",
                Password = HashPassword("dev123"),
                Email = "developer@example.com",
                DisplayName = "Charlie Developer",
                Status = "Away"
            },
            new User
            {
                Id = 5,
                Username = "designer",
                Password = HashPassword("design123"),
                Email = "designer@example.com",
                DisplayName = "Diana Designer",
                Status = "Available"
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

    public User? GetUserById(string userId)
    {
        if (int.TryParse(userId, out var id))
        {
            return _users.FirstOrDefault(u => u.Id == id);
        }
        return null;
    }

    public List<User> GetAllUsers()
    {
        return _users.ToList();
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
