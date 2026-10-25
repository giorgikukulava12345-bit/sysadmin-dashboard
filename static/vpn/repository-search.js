const input=document.querySelector('[data-repository-search]');
if(input){
  const root=input.closest('section'),links=[...root.querySelectorAll('[data-repository-files] a')],status=root.querySelector('[data-repository-status]');
  input.addEventListener('input',()=>{const query=input.value.trim().toLowerCase();let count=0;for(const link of links){link.hidden=!link.textContent.toLowerCase().includes(query);if(!link.hidden)count++;}status.textContent=count?`${count} matching files`:'No matching files. Try another name.';});
}
