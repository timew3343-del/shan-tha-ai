import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToolOutput } from '@/hooks/useToolOutput';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const formSchema = z.object({
  prompt: z.string().min(1, { message: 'Video prompt is required.' }).max(1000, { message: 'Prompt too long.' }),
  style: z.string().optional(),
  duration: z.string().optional(),
});

type VideoFormValues = z.infer<typeof formSchema>;

export default function AIVideoGenTool() {
  const { saveOutput } = useToolOutput("ai-video-gen", "AI Video Gen");
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<VideoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: '',
      style: 'cinematic', // Default style
      duration: 'medium', // Default duration
    },
  });

  const onSubmit = async (values: VideoFormValues) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('You need to be logged in to use this tool.');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: JSON.stringify({
          prompt: values.prompt,
          style: values.style,
          duration: values.duration,
        }),
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast.error(error.message);
        console.error('Video generation error:', error);
      } else if (data && data.success) {
        toast.success('Video generated successfully!');
        saveOutput('video', data.videoUrl);
      } else {
        toast.error(data?.error || 'Failed to generate video.');
      }
    } catch (err: any) {
      toast.error(err.message || 'An unexpected error occurred.');
      console.error('Video generation catch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>AI Video Generation Tool</CardTitle>
        <CardDescription>စာသားမှ ဗီဒီယိုများ ဖန်တီးပါ။</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Video Prompt</FormLabel>
                  <FormControl>
                    <Textarea placeholder="ဥပမာ- ပန်းခင်းထဲတွင် ပြေးလွှားနေသော ကလေးငယ်များ" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="style"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Video Style</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="ဗီဒီယိုပုံစံကို ရွေးပါ" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="cinematic">ရုပ်ရှင်ဆန်ဆန်</SelectItem>
                      <SelectItem value="animation">ကာတွန်း</SelectItem>
                      <SelectItem value="documentary">မှတ်တမ်းရုပ်ရှင်</SelectItem>
                      <SelectItem value="vlog">Vlog</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Video Duration</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="ကြာချိန်ကို ရွေးပါ" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="short">တိုတောင်း (10-30s)</SelectItem>
                      <SelectItem value="medium">အလယ်အလတ် (30-60s)</SelectItem>
                      <SelectItem value="long">ရှည်လျား (1-3min)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Generating...' : 'ဗီဒီယို ထုတ်လုပ်ရန်'}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter>
        <p className="text-sm text-muted-foreground">AI Video Generation Tool သည် သင်၏ prompt အပေါ်မူတည်၍ ဗီဒီယိုများကို ဖန်တီးပေးပါသည်။</p>
      </CardFooter>
    </Card>
  );
}
