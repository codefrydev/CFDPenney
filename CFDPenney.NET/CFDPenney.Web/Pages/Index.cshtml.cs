using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace CFDPenney.Web.Pages;

[AllowAnonymous]
public class IndexModel : PageModel
{
    public IActionResult OnGet()
    {
        // If user is authenticated, redirect to Canvas
        if (User.Identity?.IsAuthenticated == true)
        {
            return RedirectToPage("/Canvas");
        }
        
        // If not authenticated, show landing page
        return Page();
    }
}
