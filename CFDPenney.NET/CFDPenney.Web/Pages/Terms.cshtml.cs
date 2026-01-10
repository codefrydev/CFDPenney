using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace CFDPenney.Web.Pages;

[AllowAnonymous]
public class TermsModel : PageModel
{
    public void OnGet()
    {
    }
}
