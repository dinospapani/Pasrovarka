/* Η εφαρμογή μετακόμισε: Alkyon (πρώην BiteCast / Ψαρόβαρκα). Μεταφέρει στην ίδια σελίδα στη νέα διεύθυνση. */
(function(){
  var p=location.pathname.replace(/^\/[Pp]asrovarka/,'/Alkyon');
  if(p===location.pathname) p='/Alkyon/';
  location.replace(location.origin+p+location.search+location.hash);
})();
