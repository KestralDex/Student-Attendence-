-- Seed data for students (run after creating schema)
-- Each student has a unique QR code (their UUID)

insert into students (id, name, roll_no, email, year, qr_code) values
  ('11111111-1111-1111-1111-111111111111', 'Priya Sharma', 'FE-001', 'priya.sharma@college.edu', 'FE', '11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222', 'Rahul Patel', 'FE-002', 'rahul.patel@college.edu', 'FE', '22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333', 'Anjali Desai', 'FE-003', 'anjali.desai@college.edu', 'FE', '33333333-3333-3333-3333-333333333333'),
  ('44444444-4444-4444-4444-444444444444', 'Vikram Singh', 'SE-001', 'vikram.singh@college.edu', 'SE', '44444444-4444-4444-4444-444444444444'),
  ('55555555-5555-5555-5555-555555555555', 'Neha Gupta', 'SE-002', 'neha.gupta@college.edu', 'SE', '55555555-5555-5555-5555-555555555555'),
  ('66666666-6666-6666-6666-666666666666', 'Arjun Reddy', 'SE-003', 'arjun.reddy@college.edu', 'SE', '66666666-6666-6666-6666-666666666666'),
  ('77777777-7777-7777-7777-777777777777', 'Meera Nair', 'TE-001', 'meera.nair@college.edu', 'TE', '77777777-7777-7777-7777-777777777777'),
  ('88888888-8888-8888-8888-888888888888', 'Kunal Joshi', 'TE-002', 'kunal.joshi@college.edu', 'TE', '88888888-8888-8888-8888-888888888888'),
  ('99999999-9999-9999-9999-999999999999', 'Sneha Kulkarni', 'TE-003', 'sneha.kulkarni@college.edu', 'TE', '99999999-9999-9999-9999-999999999999'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Amit Kumar', 'BE-001', 'amit.kumar@college.edu', 'BE', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Pooja Shah', 'BE-002', 'pooja.shah@college.edu', 'BE', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Rohit Verma', 'BE-003', 'rohit.verma@college.edu', 'BE', 'cccccccc-cccc-cccc-cccc-cccccccccccc')
on conflict (id) do nothing;
