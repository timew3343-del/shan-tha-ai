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
  prompt: z.string().min(1, { message: 'Animation prompt is required.' }).max(1000, { message: 'Prompt too long.' }),
  style: z.string().optional(),
  duration: z.string().optional(),
});

type AnimationFormValues = z.infer<typeof formSchema>;

export default function AIAnimationTool() {
  const { saveOutput } = useToolOutput("ai-animation", "AI Animation");
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<AnimationFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: '',
      style: '2d_cartoon', // Default style
      duration: 'medium', // Default duration
    },
  });

  const onSubmit = async (values: AnimationFormValues) => {
    if (!user || !session) {
      toast.error('You need to be logged in to use this tool.');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-animation', {
        body: JSON.stringify({
          prompt: values.prompt,
          style: values.style,
          duration: values.duration,
        }),
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast.error(error.message);
        console.error('Animation generation error:', error);
      } else if (data && data.success) {
        toast.success('Animation generated successfully!');
        addOutput({
          tool: 'AI Animation Generation',
          type: 'video',
          content: data.animationUrl,
          metadata: { prompt: values.prompt, style: values.style, duration: values.duration, creditsUsed: data.creditsUsed },
          timestamp: new Date().toISOString(),
        });
      } else {
        toast.error(data?.error || 'Failed to generate animation.');
      }
    } catch (err: any) {
      toast.error(err.message || 'An unexpected error occurred.');
      console.error('Animation generation catch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>AI Animation Generation Tool</CardTitle>
        <CardDescription>စာသားမှ ကာတွန်းဗီဒီယိုများ ဖန်တီးပါ။</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Animation Prompt</FormLabel>
                  <FormControl>
                    <Textarea placeholder="ဥပမာ- ပျော်ရွှင်စွာ ကခုန်နေသော ကာတွန်းဇာတ်ကောင်" {...field} />
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
                  <FormLabel>Animation Style</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="ကာတွန်းပုံစံကို ရွေးပါ" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="2d_cartoon">2D ကာတွန်း</SelectItem>
                      <SelectItem value="3d_render">3D Render</SelectItem>
                      <SelectItem value="anime">Anime</SelectItem>
                      <SelectItem value="stop_motion">Stop Motion</SelectItem>
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
                  <FormLabel>Animation Duration</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="ကြာချိန်ကို ရွေးပါ" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="short">တိုတောင်း (5-15s)</SelectItem>
                      <SelectItem value="medium">အလယ်အလတ် (15-30s)</SelectItem>
                      <SelectItem value="long">ရှည်လျား (30-60s)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Generating...' : 'ကာတွန်း ထုတ်လုပ်ရန်'}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter>
        <p className="text-sm text-muted-foreground">AI Animation Generation Tool သည် သင်၏ prompt အပေါ်မူတည်၍ ကာတွန်းဗီဒီယိုများကို ဖန်တီးပေးပါသည်။</p>
      </CardFooter>
    </Card>
  );
}
