(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports) module.exports=api;
  if(root) root.BBPlannerStorage=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  function create(options){
    const key=options.key;
    const version=options.version;
    const migrate=options.migrate;
    const backend=options.backend || (typeof localStorage!=="undefined"?localStorage:null);
    if(!backend) throw new Error("Storage backend indisponível.");
    return {
      load(){
        try{
          const raw=backend.getItem(key);
          if(!raw) return null;
          const parsed=JSON.parse(raw);
          return migrate?migrate(parsed,version):parsed;
        }catch(error){
          console.warn("Falha ao ler dados do planner",error);
          return null;
        }
      },
      save(state){
        try{
          const payload=Object.assign({},state,{stateVersion:version});
          backend.setItem(key,JSON.stringify(payload));
          return true;
        }catch(error){
          console.warn("Falha ao salvar dados do planner",error);
          return false;
        }
      },
      clear(){ try{ backend.removeItem(key); return true; }catch(error){ console.warn("Falha ao limpar dados do planner",error); return false; } },
      exportRaw(){ return backend.getItem(key); }
    };
  }

  return {create};
});
