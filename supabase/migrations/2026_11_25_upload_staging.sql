-- Private temporary files, uploaded with server-issued, object-scoped signed URLs.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('upload-staging','upload-staging',false,5242880,array['application/pdf','image/jpeg','image/png']),
 ('verification-documents','verification-documents',false,5242880,array['application/pdf','image/jpeg','image/png']),
 ('resumes','resumes',false,5242880,array['application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- No public or authenticated broad access policies are added. Use the Storage API to clean abandoned staging objects.
