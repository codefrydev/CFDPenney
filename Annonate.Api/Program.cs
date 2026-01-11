using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Http;
using System.Text.Json;
using Annonate.Api.Data;
using Annonate.Api.DTOs;
using Annonate.Api.Hubs;
using Annonate.Api.Middleware;
using Annonate.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddRazorPages();
// Controllers removed - using Razor Pages only
// builder.Services.AddControllers();
// builder.Services.AddSwaggerGen();

// Database
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

// Cookie Authentication
builder.Services.AddAuthentication("Cookies")
    .AddCookie("Cookies", options =>
    {
        options.Cookie.Name = "auth_cookie";
        options.Cookie.HttpOnly = true;
        // Use Lax for development (works with HTTP), None+Secure for production (requires HTTPS)
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = CookieSecurePolicy.None; // Set to Always in production with HTTPS
        options.ExpireTimeSpan = TimeSpan.FromDays(7);
        options.SlidingExpiration = true;
        options.LoginPath = "/Login";
        options.AccessDeniedPath = "/Login";
        
        // Handle AJAX requests - return 401 JSON instead of redirecting
        options.Events = new CookieAuthenticationEvents
        {
            OnRedirectToLogin = async context =>
            {
                if (IsAjaxRequest(context.Request))
                {
                    // Prevent the redirect by handling the response ourselves
                    // Writing to the response prevents the default redirect behavior
                    context.Response.StatusCode = 401;
                    context.Response.ContentType = "application/json";
                    var response = ApiResponse<object>.ErrorResponse("Unauthorized. Please log in.");
                    var json = JsonSerializer.Serialize(response);
                    await context.Response.WriteAsync(json);
                    // Don't call Redirect - writing to response prevents it
                }
                else
                {
                    // Allow normal redirect for non-AJAX requests
                    context.Response.Redirect(context.RedirectUri);
                }
            },
            OnRedirectToAccessDenied = async context =>
            {
                if (IsAjaxRequest(context.Request))
                {
                    // Prevent the redirect by handling the response ourselves
                    // Writing to the response prevents the default redirect behavior
                    context.Response.StatusCode = 403;
                    context.Response.ContentType = "application/json";
                    var response = ApiResponse<object>.ErrorResponse("Access denied.");
                    var json = JsonSerializer.Serialize(response);
                    await context.Response.WriteAsync(json);
                    // Don't call Redirect - writing to response prevents it
                }
                else
                {
                    // Allow normal redirect for non-AJAX requests
                    context.Response.Redirect(context.RedirectUri);
                }
            }
        };
    });

// Helper method to detect AJAX requests
static bool IsAjaxRequest(HttpRequest request)
{
    var acceptHeader = request.Headers["Accept"].ToString();
    var requestedWithHeader = request.Headers["X-Requested-With"].ToString();
    
    return acceptHeader.Contains("application/json", StringComparison.OrdinalIgnoreCase) ||
           requestedWithHeader.Equals("XMLHttpRequest", StringComparison.OrdinalIgnoreCase);
}

// CORS removed - not needed for Razor Pages (same-origin)


// SignalR
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
});

// Application Services
builder.Services.AddScoped<IAuthService, AuthService>();

var app = builder.Build();

// CORS removed - not needed for Razor Pages

// Configure the HTTP request pipeline
// Swagger removed - using Razor Pages only
// if (app.Environment.IsDevelopment())
// {
//     app.UseSwagger();
//     app.UseSwaggerUI();
// }

// Skip HTTPS redirection in development to avoid CORS issues
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseMiddleware<ErrorHandlingMiddleware>();
app.UseStaticFiles(); // For wwwroot files
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();

// Map Razor Pages
app.MapRazorPages();

// SignalR Hub
app.MapHub<ChatHub>("/hubs/chat");

// Ensure database is created and seeded
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    DbInitializer.Initialize(db);
}

app.Run();
