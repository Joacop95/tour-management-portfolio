import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import type { GroupImportRow } from "@/lib/utils/group-import"

export async function importSupabaseGroupRow(row: GroupImportRow) {
  const supabase=getSupabaseBrowserClient(); if(!supabase)return {success:false,message:"Supabase is unavailable."}
  const {data,error}=await supabase.rpc("import_group_row",{p_group_code:row.groupCode,p_circuit_id:row.circuitId,p_guide_id:row.guideId,p_group_status:row.groupStatus,p_start_date:row.startDateIso||null,p_end_date:row.endDateIso||null})
  if(error)return {success:false,message:"Group could not be imported."}; const result=Array.isArray(data)?data[0]:null
  return {success:Boolean(result?.success),message:result?.message??"Group could not be imported."}
}
