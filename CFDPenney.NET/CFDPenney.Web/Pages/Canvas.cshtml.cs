using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace CFDPenney.Web.Pages;

[Authorize]
public class CanvasModel : PageModel
{
    public void OnGet(string? code = null)
    {
        // Code parameter will be handled by JavaScript
    }
}
