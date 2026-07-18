/* Story Archive form stability fix: change templates without closing the modal. */
(function(){
  window.saveStoryArchiveDraftCategory=function(){
    const select=document.querySelector('#archiveCategory');
    if(!select)return;
    const section=document.querySelector('#modalBody .archive-template');
    if(!section||typeof archiveV1TemplateForm!=='function')return;
    const card={category:select.value,templateData:{}};
    section.outerHTML=archiveV1TemplateForm(card);
    document.querySelector('#archiveTitle')?.focus();
  };
})();
