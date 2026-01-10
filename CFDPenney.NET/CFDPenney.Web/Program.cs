using CFDPenney.Web.Hubs;
using CFDPenney.Web.Services;
using Microsoft.AspNetCore.Authentication.Cookies;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorPages();
builder.Services.AddSignalR();
// Register services in dependency order
builder.Services.AddSingleton<IUserService, UserService>();
builder.Services.AddSingleton<IPresenceService, PresenceService>();
builder.Services.AddSingleton<IChatService, ChatService>();
builder.Services.AddSingleton<ISessionService, SessionService>();
builder.Services.AddSingleton<ICallService, CallService>();
builder.Services.AddHostedService<SessionCleanupService>();

// Configure authentication
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.LoginPath = "/SignIn";
        options.LogoutPath = "/SignOut";
        options.ExpireTimeSpan = TimeSpan.FromDays(7);
        options.SlidingExpiration = true;
        options.Cookie.HttpOnly = true;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
    });

// Configure authorization - require authentication by default for all pages
builder.Services.AddAuthorization(options =>
{
    // Set fallback policy to require authentication
    // Pages with [AllowAnonymous] will override this
    options.FallbackPolicy = options.DefaultPolicy;
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
    app.UseHttpsRedirection();
}
else
{
    // In development, only use HTTPS redirection if HTTPS is available
    var httpsPort = builder.Configuration["HTTPS_PORT"] ?? 
                    Environment.GetEnvironmentVariable("ASPNETCORE_HTTPS_PORT");
    if (!string.IsNullOrEmpty(httpsPort))
    {
        app.UseHttpsRedirection();
    }
}

app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.MapStaticAssets();
app.MapRazorPages()
   .WithStaticAssets();

// Map SignalR hubs
app.MapHub<CollaborationHub>("/collaborationHub");
app.MapHub<ChatHub>("/chatHub");

app.Run();
